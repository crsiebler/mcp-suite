export interface GitHubConfig {
  token: string;
  baseUrl?: string; // For GitHub Enterprise
}

export interface GitHubConfig {
  token: string;
  baseUrl?: string; // For GitHub Enterprise
}

export interface GitHubRepository {
  // Core repository properties
  id: number;
  name: string;
  full_name: string;
  owner?: {
    login: string;
    id?: number;
    avatar_url: string;
    html_url: string;
  } | null;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
  homepage?: string | null;
  size?: number;
  stargazers_count?: number;
  watchers_count?: number;
  default_branch?: string;

  // Additional properties from GitHub API documentation
  forks_count?: number; // Available in detailed repo view
  open_issues_count?: number; // Available in detailed repo view
  subscribers_count?: number; // Available in detailed repo view
  network_count?: number; // Available in detailed repo view
  language?: string | null; // Primary language, available in search results
  topics?: string[]; // Repository topics
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  has_pages?: boolean;
  has_downloads?: boolean;
  has_discussions?: boolean;
  archived?: boolean;
  disabled?: boolean;
  visibility?: string; // API returns string, not union type

  // Optional API properties that may not be present in all responses
  license?: {
    key: string;
    name: string;
    spdx_id?: string | null;
    url: string | null; // API can return null
    node_id: string;
  } | null;
  allow_forking?: boolean;
  is_template?: boolean;
  web_commit_signoff_required?: boolean;
  custom_properties?: Record<string, any>;
  organization?: {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    html_url: string;
  } | null;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
  security_and_analysis?: any; // Making this more flexible to match API responses
}

export interface GitHubContent {
  type: "file" | "dir";
  size?: number;
  name: string;
  path: string;
  content?: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string | null;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubContributor {
  login?: string;
  id?: number;
  node_id?: string;
  avatar_url?: string;
  gravatar_id?: string | null;
  url?: string;
  html_url?: string;
  followers_url?: string;
  following_url?: string;
  gists_url?: string;
  starred_url?: string;
  subscriptions_url?: string;
  organizations_url?: string;
  repos_url?: string;
  events_url?: string;
  received_events_url?: string;
  type?: string;
  site_admin?: boolean;
  contributions: number;
}

export interface GitHubLanguageStats {
  [language: string]: number;
}

// Interface for search results which may have additional properties
export interface GitHubSearchRepository {
  // All GitHubRepository properties - making them more permissive to match actual API responses
  id: number;
  name: string;
  full_name: string;
  owner: any; // Making this more flexible to match API response
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
  homepage?: string | null;
  size?: number;
  stargazers_count?: number;
  watchers_count?: number;
  default_branch?: string;
  forks_count?: number;
  open_issues_count?: number;
  subscribers_count?: number;
  network_count?: number;
  language?: string | null;
  topics?: string[];
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  has_pages?: boolean;
  has_downloads?: boolean;
  has_discussions?: boolean;
  archived?: boolean;
  disabled?: boolean;
  visibility?: string;
  license?: any; // Making this more flexible
  allow_forking?: boolean;
  is_template?: boolean;
  web_commit_signoff_required?: boolean;
  custom_properties?: Record<string, any>;
  organization?: any;
  permissions?: any;
  security_and_analysis?: any;
  // Search result specific properties
  score?: number;
  text_matches?: any[];
}

// Union type for repository API responses which can vary by endpoint
export type GitHubRepositoryResponse = GitHubRepository | GitHubSearchRepository;

export interface ListUserRepositoriesRequest {
  username: string;
  type?: "all" | "owner" | "member";
  sort?: "created" | "updated" | "pushed" | "full_name";
  direction?: "asc" | "desc";
  per_page?: number;
  page?: number;
}

export interface GetRepositoryRequest {
  owner: string;
  repo: string;
}

export interface ListRepositoryContentsRequest {
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
}

export interface GetFileContentRequest {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export interface SearchRepositoriesRequest {
  q: string;
  sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
  order?: "asc" | "desc";
  per_page?: number;
  page?: number;
}

export interface GetRepositoryReadmeRequest {
  owner: string;
  repo: string;
  ref?: string;
}

export interface ListBranchesRequest {
  owner: string;
  repo: string;
  protected?: boolean;
  per_page?: number;
  page?: number;
}

export interface ListLanguagesRequest {
  owner: string;
  repo: string;
}

export interface ListContributorsRequest {
  owner: string;
  repo: string;
  anon?: boolean;
  per_page?: number;
  page?: number;
}