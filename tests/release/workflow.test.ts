import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const root = resolve(__dirname, "../..");
const workflow = require("js-yaml").load(
  readFileSync(resolve(root, ".github/workflows/release.yml"), "utf8")
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const step = (job: string, id: string) =>
  workflow.jobs[job].steps.find((item: { id: string }) => item.id === id);
const sha = "a".repeat(40);

it("does not require a private npm mirror to install the hosted candidate", () => {
  const lock = JSON.parse(
    readFileSync(resolve(root, "package-lock.json"), "utf8")
  );
  for (const pkg of Object.values(lock.packages) as Array<{
    resolved?: string;
  }>) {
    if (pkg.resolved?.startsWith("http"))
      expect(new URL(pkg.resolved).origin).toBe("https://registry.npmjs.org");
  }
});
const context = {
  eventName: "workflow_dispatch",
  ref: "refs/heads/release",
  sha,
  repo: { owner: "fixture", repo: "suite" },
  payload: { inputs: { operation: "publish" } },
};
const environment = {
  protection_rules: [
    {
      type: "required_reviewers",
      prevent_self_review: true,
      reviewers: [{ type: "User", reviewer: { id: 42 } }],
    },
  ],
};
const activationEnv = {
  RELEASE_WORKFLOW_ENABLED: "true",
  RELEASE_BRANCH: "release",
  NPM_PUBLISHING_ENABLED: "true",
  TRUSTED_PUBLISHERS_READY: "true",
  LICENSE_REVIEWED: "true",
};
function activate(
  env = activationEnv,
  protection = environment,
  operation = "publish"
) {
  const github = {
    rest: {
      repos: {
        getEnvironment: vi.fn().mockResolvedValue({ data: protection }),
      },
    },
  };
  return new AsyncFunction(
    "github",
    "context",
    "process",
    "require",
    step("preflight", "activation").with.script
  )(
    github,
    { ...context, payload: { inputs: { operation } } },
    { env },
    () => ({ baseBranch: "release" })
  );
}

it("has no push publication trigger and isolates OIDC behind successful verification and environment approval", () => {
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(workflow.jobs.preflight.permissions).toEqual({
    contents: "read",
    actions: "read",
  });
  expect(workflow.jobs.publish.needs).toEqual(["preflight", "candidate"]);
  expect(workflow.jobs.publish.if).toBe(
    "inputs.operation == 'publish' && needs.candidate.result == 'success'"
  );
  expect(workflow.jobs.publish.environment).toBe("npm-publish");
  expect(workflow.jobs.publish["runs-on"]).toBe("ubuntu-latest");
  expect(workflow.jobs.publish.permissions["id-token"]).toBe("write");
  for (const name of ["preflight", "prepare", "candidate"])
    expect(workflow.jobs[name].permissions?.["id-token"]).toBeUndefined();
  expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  const action = step("publish", "publication");
  expect(action.uses).toBe("changesets/action/publish@v2.1.1");
  expect(action.with["create-github-releases"]).toBe(false);
  expect(action.with.script).toBe(
    "node node_modules/@changesets/cli/bin.js publish --from-pack-dir dist/release"
  );
  const download = workflow.jobs.publish.steps.find((item: { uses?: string }) =>
    item.uses?.startsWith("actions/download-artifact")
  );
  expect(download.with["artifact-ids"]).toBe(
    "${{ needs.candidate.outputs.artifact-id }}"
  );
  expect(step("publish", "announce").if).toBe(
    "${{ !cancelled() && steps.verified.outcome == 'success' && steps.publication.outputs.published == 'true' }}"
  );
});

it("requires all publication activation declarations", async () => {
  await expect(activate()).resolves.toBeUndefined();
  for (const name of Object.keys(activationEnv)) {
    await expect(activate({ ...activationEnv, [name]: "" })).rejects.toThrow();
  }
  await expect(
    activate(
      { ...activationEnv, NPM_PUBLISHING_ENABLED: "" },
      environment,
      "prepare"
    )
  ).resolves.toBeUndefined();
});

it("does not enter publication after failed, cancelled or skipped candidate checks", () => {
  const allowed = new Function(
    "inputs",
    "needs",
    `return (${workflow.jobs.publish.if});`
  );
  for (const result of ["failure", "cancelled", "skipped"]) {
    expect(allowed({ operation: "publish" }, { candidate: { result } })).toBe(
      false
    );
  }
  expect(
    allowed({ operation: "prepare" }, { candidate: { result: "success" } })
  ).toBe(false);
  expect(
    allowed({ operation: "publish" }, { candidate: { result: "success" } })
  ).toBe(true);
  for (const item of workflow.jobs.candidate.steps)
    expect(item["continue-on-error"]).toBeUndefined();
});

it("fails closed when approval protection is absent or permits self-approval", async () => {
  await expect(
    activate(activationEnv, { protection_rules: [] })
  ).rejects.toThrow(/reviewers/);
  await expect(
    activate(activationEnv, {
      protection_rules: [{ ...environment.protection_rules[0], reviewers: [] }],
    })
  ).rejects.toThrow(/reviewers/);
  await expect(
    activate(activationEnv, {
      protection_rules: [
        { ...environment.protection_rules[0], prevent_self_review: false },
      ],
    })
  ).rejects.toThrow(/self-approval/);
});

function announcement(
  tagSha = sha,
  releaseFailure = false,
  missingTag = false
) {
  const getRef = missingTag
    ? vi.fn().mockRejectedValue(new Error("Tag not found"))
    : vi.fn().mockResolvedValue({
        data: { object: { type: "commit", sha: tagSha } },
      });
  const createRelease = releaseFailure
    ? vi.fn().mockRejectedValue(new Error("GitHub unavailable"))
    : vi.fn().mockResolvedValue({});
  const github = {
    rest: { git: { getRef, getTag: vi.fn() }, repos: { createRelease } },
  };
  const plan = [{ name: "@fixture/example", version: "1.2.0" }];
  const loader = (name: string) => {
    if (name === "node:fs")
      return {
        readFileSync: () =>
          "# Example\n\n## 1.2.0\n\nFixed a bug.\n\n## 1.1.0\n\nOld release.\n",
      };
    if (name === "node:path") return require(name);
    if (name.endsWith("release-artifacts.cjs"))
      return { verifyBundle: () => plan };
    if (name.endsWith("packages.cjs"))
      return {
        readPackages: () => [{ manifest: plan[0], path: "/fixture/example" }],
      };
    throw new Error("Unexpected module");
  };
  const run = (published = plan) =>
    new AsyncFunction(
      "github",
      "context",
      "process",
      "require",
      step("publish", "announce").with.script
    )(
      github,
      context,
      {
        cwd: () => "/fixture",
        env: { PUBLISHED_PACKAGES: JSON.stringify(published) },
      },
      loader
    );
  return { run, createRelease, getRef };
}

it("announces confirmed versions using only their changelog and verified source", async () => {
  const fixture = announcement();
  await fixture.run();
  expect(fixture.createRelease).toHaveBeenCalledWith({
    ...context.repo,
    name: "@fixture/example@1.2.0",
    tag_name: "@fixture/example@1.2.0",
    target_commitish: sha,
    body: "Fixed a bug.",
    prerelease: false,
  });
});

it("does not announce absent, unplanned, missing-tag or wrong-commit publications", async () => {
  for (const fixture of [
    announcement("b".repeat(40)),
    announcement(sha, false, true),
  ]) {
    await expect(fixture.run()).rejects.toThrow();
    expect(fixture.createRelease).not.toHaveBeenCalled();
  }
  const fixture = announcement();
  await expect(fixture.run([])).rejects.toThrow(/confirmed/);
  await expect(
    fixture.run([{ name: "@fixture/unplanned", version: "1.2.0" }])
  ).rejects.toThrow(/Unexpected/);
  expect(fixture.createRelease).not.toHaveBeenCalled();
});

it("propagates announcement failure after publication without retrying publication", async () => {
  const fixture = announcement(sha, true);
  await expect(fixture.run()).rejects.toThrow(/GitHub unavailable/);
  expect(fixture.createRelease).toHaveBeenCalledTimes(1);
  expect(fixture.getRef).toHaveBeenCalledTimes(1);
});
