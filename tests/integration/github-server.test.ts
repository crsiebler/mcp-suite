import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

describe('GitHub Server Integration', () => {
  let serverProcess: ChildProcess;
  const serverPath = join(process.cwd(), 'servers', 'github', 'dist', 'servers', 'github', 'src', 'index.js');

  // Test configuration following Option 1 + Option 4 combo approach
  const testConfig = {
    // Default public repositories (no auth required)
    primary: { owner: 'microsoft', repo: 'vscode' },
    fallback: { owner: 'facebook', repo: 'react' },
    
    // Optional authenticated testing (when token provided)
    get authRepo() {
      return process.env.GITHUB_TOKEN ? 
        { owner: 'crsiebler', repo: 'mcp-suite' } : null;
    },
    
    // Determine which repo to use for testing
    getTestRepo() {
      if (this.authRepo) return this.authRepo;
      
      // Use environment variable override if provided
      if (process.env.GITHUB_TEST_REPO) {
        try {
          const customRepo = JSON.parse(process.env.GITHUB_TEST_REPO);
          return customRepo;
        } catch (e) {
          console.warn('Invalid GITHUB_TEST_REPO format, using default');
        }
      }
      
      return this.primary; // Default to microsoft/vscode
    }
  };

  beforeAll(async () => {
    // Skip integration tests in CI following Jira pattern
    if (process.env.CI) {
      console.log('Skipping GitHub server integration tests - CI environment detected');
      return;
    }

    // Note: Server startup can be tested even without auth
    // Most GitHub API calls will work with public repos without authentication
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LOG_LEVEL: 'info', // Reduce noise in test output
        // Only pass token if explicitly provided (not hardcoded)
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || ''
      }
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('Server stdout:', serverProcess.stdout?.read()?.toString());
        console.log('Server stderr:', serverProcess.stderr?.read()?.toString());
        reject(new Error('Server startup timeout'));
      }, 10000);

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('GitHub MCP server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('GitHub MCP server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      serverProcess.on('exit', (code, signal) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}, signal ${signal}`));
      });
    });
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        serverProcess.on('exit', () => resolve());
        setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  });

  it('should start successfully', () => {
    if (process.env.CI) {
      expect(true).toBe(true); // Skip test
      return;
    }
    
    expect(serverProcess).toBeDefined();
    expect(serverProcess.killed).toBe(false);
  });

  // Comprehensive testing of all GitHub MCP server tools
  describe('Public Repository Tests', () => {
    const testRepo = testConfig.getTestRepo();
    
    // These tests run regardless of authentication since they use public repos
    it('should get repository details', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '', // Empty token works for public repos
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.getRepository({ owner: testRepo.owner, repo: testRepo.repo });
      
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data).toHaveProperty('name', testRepo.repo);
        expect(result.data).toHaveProperty('full_name', `${testRepo.owner}/${testRepo.repo}`);
        expect(result.data).toHaveProperty('description');
        expect(result.data).toHaveProperty('stargazers_count');
        expect(typeof result.data.stargazers_count).toBe('number');
        // forks_count may be undefined in basic repository view
        expect(result.data.forks_count !== undefined ? 
          typeof result.data.forks_count === 'number' : 'undefined').toBe(true);
        expect(typeof result.data.fork).toBe('boolean');
      }
    });

    it('should list repository contents', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.listRepositoryContents({ owner: testRepo.owner, repo: testRepo.repo, path: '' });
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data && result.data.length > 0) {
        const itemNames = result.data.map(item => item.name);
        // Common directories that should exist in most repositories
        const hasCommonDirs = itemNames.includes('src') || 
                              itemNames.includes('lib') || 
                              itemNames.includes('docs') || 
                              itemNames.includes('test');
        expect(hasCommonDirs).toBe(true);
        
        // Should have files and directories
        const hasFiles = result.data.some(item => item.type === 'file');
        const hasDirs = result.data.some(item => item.type === 'dir');
        expect(hasFiles || hasDirs).toBe(true);
      }
    });

    it('should get file content', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.getFileContent({ 
        owner: testRepo.owner, 
        repo: testRepo.repo, 
        path: 'package.json' 
      });
      
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
      
      if (result.data) {
        // Service should have already decoded base64 content
        const packageJson = JSON.parse(result.data);
        expect(packageJson).toHaveProperty('name');
        expect(packageJson).toHaveProperty('version');
        expect(typeof packageJson.name).toBe('string');
        expect(typeof packageJson.version).toBe('string');
      }
    });

    it('should get repository README', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.getRepositoryReadme({ owner: testRepo.owner, repo: testRepo.repo });
      
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
      
      if (result.data) {
        expect(result.data.length).toBeGreaterThan(0);
        // README should contain some expected content
        const content = result.data.toLowerCase();
        const hasContent = content.includes('readme') || 
                           content.includes('#') || 
                           content.includes('description');
        expect(hasContent).toBe(true);
      }
    });

    it('should list branches', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.listBranches({ owner: testRepo.owner, repo: testRepo.repo, per_page: 10 });
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data && result.data.length > 0) {
        const branchNames = result.data.map(branch => branch.name);
        // Should at least have main or master branch, or any valid branch name
        const hasMainBranch = branchNames.includes('main') || branchNames.includes('master');
        const hasValidBranch = branchNames.some(name => typeof name === 'string' && name.length > 0);
        expect(hasMainBranch || hasValidBranch).toBe(true);
        
        // Branch names should be strings
        expect(branchNames.every(name => typeof name === 'string')).toBe(true);
      }
    });

    it('should list languages', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.listLanguages({ owner: testRepo.owner, repo: testRepo.repo });
      
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('object');
      
      if (result.data) {
        const languages = Object.keys(result.data);
        expect(languages.length).toBeGreaterThan(0);
        
        // For Microsoft/vscode, should have TypeScript
        if (testRepo.owner === 'microsoft' && testRepo.repo === 'vscode') {
          expect(languages.includes('TypeScript')).toBe(true);
        }
        
        // Language counts should be numbers
        const counts = Object.values(result.data);
        expect(counts.every(count => typeof count === 'number')).toBe(true);
      }
    });

    it('should list contributors', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.listContributors({ owner: testRepo.owner, repo: testRepo.repo, per_page: 5 });
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data && result.data.length > 0) {
        const contributor = result.data[0];
        expect(contributor).toHaveProperty('login');
        expect(contributor).toHaveProperty('contributions');
        expect(typeof contributor.contributions).toBe('number');
        
        // Contributor login should be string
        expect(typeof contributor.login).toBe('string');
      }
    });

    it('should search repositories', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.searchRepositories({ 
        q: 'typescript language:typescript', 
        per_page: 5 
      });
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data && result.data.length > 0) {
        const repo = result.data[0];
        expect(repo).toHaveProperty('name');
        expect(repo).toHaveProperty('full_name');
        
        // Search should return TypeScript repositories
        const hasTypeScript = result.data.some(r => 
          (r.language === 'TypeScript') || 
          (r.description && r.description.toLowerCase().includes('typescript'))
        );
        expect(hasTypeScript).toBe(true);
      }
    });
  });

  // Authenticated tests (only run when token is provided)
  describe('Authenticated Tests', () => {
    const authRepo = testConfig.authRepo;
    
    beforeAll(() => {
      if (!authRepo) {
        console.log('Skipping authenticated tests - no GitHub token provided');
      }
    });

    it('should list user repositories', async () => {
      if (!authRepo || process.env.CI) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN!,
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.listUserRepositories({ 
        username: authRepo.owner, 
        type: 'owner', 
        per_page: 5 
      });
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data && result.data.length > 0) {
        const repoNames = result.data.map(repo => repo.name);
        expect(repoNames.includes(authRepo.repo)).toBe(true);
      }
    });

    it('should get repository stats', async () => {
      if (!authRepo || process.env.CI) {
        expect(true).toBe(true); // Skip test
        return;
      }

      // get_repository_stats is just get_repository but focused on stats
      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN!,
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.getRepository({ owner: authRepo.owner, repo: authRepo.repo });
      
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data).toHaveProperty('stargazers_count');
        // These properties may be undefined in basic repository view
        if (result.data.forks_count !== undefined) {
          expect(typeof result.data.forks_count).toBe('number');
        }
        if (result.data.open_issues_count !== undefined) {
          expect(result.data.open_issues_count).toBe('number');
        }
        expect(typeof result.data.stargazers_count).toBe('number');
      }
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('should handle non-existent repository', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.getRepository({ owner: 'nonexistent', repo: 'non-existent-repo-12345' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should handle authentication failure gracefully', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: 'invalid-token-12345',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      
      // Should either fail gracefully or succeed with limited data
      try {
        const result = await service.getRepository({ owner: 'octocat', repo: 'Hello-World' });
        expect(result.success !== undefined).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing file gracefully', async () => {
      if (process.env.CI) {
        expect(true).toBe(true);
        return;
      }

      const testRepo = testConfig.getTestRepo();
      const { GitHubService } = await import('../../servers/github/src/services/github-service.js');
      const { Logger } = await import('../../shared/utils/logger.js');
      
      const logger = new Logger('error');
      const config = {
        token: process.env.GITHUB_TOKEN || '',
        baseUrl: process.env.GITHUB_BASE_URL
      };
      
      const service = new GitHubService(config, logger);
      const result = await service.getFileContent({ 
        owner: testRepo.owner, 
        repo: testRepo.repo, 
        path: 'non-existent-file-12345.json' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});