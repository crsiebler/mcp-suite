import { Octokit } from "@octokit/rest";
import { Logger } from "../../../../shared/utils/logger.js";
import { ErrorHandler } from "../../../../shared/middleware/error-handler.js";
import { ServerResponse } from "../../../../shared/types/common.js";
import {
  GitHubConfig,
  GitHubRepositoryResponse,
  GitHubRepository,
  GitHubContent,
  GitHubBranch,
  GitHubContributor,
  GitHubLanguageStats,
  ListUserRepositoriesRequest,
  GetRepositoryRequest,
  ListRepositoryContentsRequest,
  GetFileContentRequest,
  SearchRepositoriesRequest,
  GetRepositoryReadmeRequest,
  ListBranchesRequest,
  ListLanguagesRequest,
  ListContributorsRequest,
} from "../types.js";
export class GitHubService {
  private octokit: Octokit;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private config: GitHubConfig;

  constructor(config: GitHubConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.withContext({ server: "github" });
    this.errorHandler = new ErrorHandler(this.logger);

    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl,
    });
  }

  async listUserRepositories(params: ListUserRepositoriesRequest): Promise<ServerResponse<GitHubRepositoryResponse[]>> {
    try {
      this.logger.info("Listing repositories", { username: params.username });

      const response = await this.octokit.repos.listForUser({
        username: params.username,
        type: params.type || "owner",
        sort: params.sort || "updated",
        direction: params.direction || "desc",
        per_page: params.per_page || 30,
        page: params.page || 1,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async getRepository(params: GetRepositoryRequest): Promise<ServerResponse<GitHubRepository>> {
    try {
      this.logger.info("Getting repository", { owner: params.owner, repo: params.repo });

      const response = await this.octokit.repos.get({
        owner: params.owner,
        repo: params.repo,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async listRepositoryContents(params: ListRepositoryContentsRequest): Promise<ServerResponse<GitHubContent[]>> {
    try {
      this.logger.info("Listing repository contents", {
        owner: params.owner,
        repo: params.repo,
        path: params.path
      });

      const response = await this.octokit.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: params.path || "",
        ref: params.ref,
      });

      // Handle both single file and array responses
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data as any,
        };
      } else {
        return {
          success: true,
          data: [response.data as GitHubContent],
        };
      }
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async getFileContent(params: GetFileContentRequest): Promise<ServerResponse<string>> {
    try {
      this.logger.info("Getting file content", {
        owner: params.owner,
        repo: params.repo,
        path: params.path
      });

      const response = await this.octokit.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: params.path,
        ref: params.ref,
      });

      // Handle file content (base64 encoded)
      if ("content" in response.data && typeof response.data.content === "string") {
        return {
          success: true,
          data: Buffer.from(response.data.content, "base64").toString("utf-8"),
        };
      }

      return {
        success: false,
        error: "Content is not a file or not accessible",
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async searchRepositories(params: SearchRepositoriesRequest): Promise<ServerResponse<GitHubRepositoryResponse[]>> {
    try {
      this.logger.info("Searching repositories", { query: params.q });

      const response = await this.octokit.search.repos({
        q: params.q,
        sort: params.sort as any || undefined,
        order: params.order || "desc",
        per_page: params.per_page || 30,
        page: params.page || 1,
      });

      return {
        success: true,
        data: response.data.items,
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async getRepositoryReadme(params: GetRepositoryReadmeRequest): Promise<ServerResponse<string>> {
    try {
      this.logger.info("Getting repository README", {
        owner: params.owner,
        repo: params.repo
      });

      const response = await this.octokit.repos.getReadme({
        owner: params.owner,
        repo: params.repo,
        ref: params.ref,
      });

      // Handle README content (base64 encoded)
      if ("content" in response.data && typeof response.data.content === "string") {
        return {
          success: true,
          data: Buffer.from(response.data.content, "base64").toString("utf-8"),
        };
      }

      return {
        success: false,
        error: "README content is not accessible",
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async listBranches(params: ListBranchesRequest): Promise<ServerResponse<GitHubBranch[]>> {
    try {
      this.logger.info("Listing branches", { owner: params.owner, repo: params.repo });

      const response = await this.octokit.repos.listBranches({
        owner: params.owner,
        repo: params.repo,
        protected: params.protected,
        per_page: params.per_page || 30,
        page: params.page || 1,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async listLanguages(params: ListLanguagesRequest): Promise<ServerResponse<GitHubLanguageStats>> {
    try {
      this.logger.info("Listing languages", { owner: params.owner, repo: params.repo });

      const response = await this.octokit.repos.listLanguages({
        owner: params.owner,
        repo: params.repo,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }

  async listContributors(params: ListContributorsRequest): Promise<ServerResponse<GitHubContributor[]>> {
    try {
      this.logger.info("Listing contributors", { owner: params.owner, repo: params.repo });

      const response = await this.octokit.repos.listContributors({
        owner: params.owner,
        repo: params.repo,
        anon: params.anon ? "true" : "false",
        per_page: params.per_page || 30,
        page: params.page || 1,
      });

      return {
        success: true,
        data: response.data as GitHubContributor[],
      };
    } catch (error) {
      return this.errorHandler.handleApiError(error, "GitHub");
    }
  }
}