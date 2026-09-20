# MCP Suite

A comprehensive monorepo suite of MCP (Model Context Protocol) servers built for standardized development and deployment.

## Development and AI guidance

[AGENTS.md](AGENTS.md) contains harness-neutral repository instructions.
Start with the [repository map](docs/overview.md) for architecture, extension
points, and verification guidance. All AI harnesses use the same instructions.

## 🏗️ Architecture

```
mcp-suite/
├── docs/               # Documentation and setup guides
├── shared/             # Shared utilities and types
│   ├── types/          # Common TypeScript interfaces
│   ├── utils/          # Utility functions (logger, config, validation)
│   └── middleware/     # Reusable middleware (auth, error handling)
├── servers/            # Individual MCP servers
│   ├── aijobsearch/   # ASU skills extraction and job matching
│   ├── flight/        # Duffel flight search and booking
│   ├── canvas/        # Canvas LMS server for educational workflows
│   ├── postgresql/    # PostgreSQL database management server
│   ├── salesforce/    # Salesforce CRM server with OAuth authentication
│   ├── clickup/       # ClickUp server for task and project management
│   └── elasticsearch/ # Elasticsearch server for search and analytics
├── scripts/           # Build and deployment scripts
├── config/            # Environment-specific configurations
└── tests/             # Test suite (unit, integration, fixtures)
```

## 🚀 Quick Start

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/crsiebler/mcp-suite.git
   cd mcp-suite
   npm install
   ```

2. **Build all servers:**

   ```bash
   npm run build -- --server=all
   ```

## 📖 Setup Documentation

For retained client-specific setup examples, see the guide below. Verify package
availability and compiled paths before use; engineering guidance lives in the
[repository map](docs/overview.md).

📋 **[MCP Setup Guide](docs/MCP_SETUP_GUIDE.md)**

## Package ownership

This checkout is maintained at [crsiebler/mcp-suite](https://github.com/crsiebler/mcp-suite).
Server manifests and examples use the `@crsiebler` npm scope. Renaming source
metadata does not publish or transfer npm packages; registry-based examples
require the corresponding package to be published first. Until then, use the
[local build workflow](docs/server-development.md). Package author metadata identifies Cory <cory.siebler@phitechsolutions.com>.
Original implementation credit remains with Azharuddin; existing license
declarations and historical release records are retained.

## 📦 Available Servers

Seven local servers remain: AIJobSearch, Canvas, ClickUp, Elasticsearch,
Flight (Duffel), PostgreSQL, and Salesforce.

For Jira Cloud, use the [official Atlassian Rovo MCP](docs/atlassian-rovo.md).


<details>
<summary><strong>🐘 PostgreSQL Server</strong> - Database management and analytics</summary>

### [PostgreSQL Server](servers/postgresql/README.md)

**Package:** `@crsiebler/mcp-postgresql-server`

**Description:** PostgreSQL database management and query execution server for database operations, schema inspection, and analytics.

**Quick Setup:**

- `POSTGRESQL_CONNECTION_STRING` - Your PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/database`)

**Key Features:** SQL query execution, table schema inspection, database statistics, connection testing, and comprehensive PostgreSQL database management.

**Available Tools (5):**

```
execute_query, list_tables, get_database_stats, test_connection
```

</details>

<details>
<summary><strong>☁️ Salesforce Server</strong> - CRM integration with OAuth</summary>

### [Salesforce Server](servers/salesforce/README.md)

**Package:** `@crsiebler/mcp-salesforce-server`

**Description:** Salesforce CRM integration with CRUD operations using REST APIs and OAuth authentication support.

**Quick Setup:**

- **Required Environment Variables**: `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`
- **Optional Variables**: `SALESFORCE_GRANT_TYPE`, `SALESFORCE_LOGIN_URL`, `SALESFORCE_API_VERSION`

**Key Features:** Automatic OAuth authentication with token persistence, SOQL queries, record CRUD operations, object metadata inspection, auto token renewal, and comprehensive Salesforce REST API coverage.

**Available Tools (7):**

```
salesforce_query, salesforce_create, salesforce_read, salesforce_update,
salesforce_delete, salesforce_describe, salesforce_list_objects
```

</details>


<details>
<summary><strong>📋 ClickUp Server</strong> - Task management and project organization</summary>

### [ClickUp Server](servers/clickup/README.md)

**Package:** `@crsiebler/mcp-clickup-server`

**Description:** Comprehensive ClickUp integration for task management, project organization, time tracking, and team collaboration.

**Quick Setup:**

- `CLICKUP_API_TOKEN` - Your ClickUp API token

**Key Features:** Task CRUD operations, project hierarchy management (spaces/folders/lists), comment system, team collaboration, time tracking, and goal management.

**Available Tools (29):**

```
get_tasks, get_task, create_task, update_task, delete_task, get_task_comments,
create_task_comment, get_lists, get_folderless_lists, create_list,
create_folderless_list, update_list, delete_list, get_folders, create_folder,
update_folder, delete_folder, get_spaces, get_space, create_space, update_space,
delete_space, get_teams, get_team_members, get_user, get_time_entries,
create_time_entry, get_goals, create_goal
```

</details>


<details>
<summary><strong>🎓 Canvas Server</strong> - Learning management system integration</summary>

### [Canvas Server](servers/canvas/README.md)

**Package:** `@crsiebler/mcp-canvas-server`

**Description:** Comprehensive Canvas LMS integration for course management, enrollment operations, grading, and administrative tasks.

**Quick Setup:**

- `CANVAS_BASE_URL` - Your Canvas instance URL (e.g., `https://your-school.instructure.com`)
- `CANVAS_API_TOKEN` - Your Canvas API access token

**Key Features:** Course management, enrollment utilities, user administration, assignment/quiz tools, grading standards, grade change auditing, admin management, and comprehensive Canvas API coverage.

**Available Tools (185):**

```
# Admin Tools (4)
make_account_admin, remove_account_admin, list_account_admins, list_my_admin_roles

# Assignment Tools (14)
list_assignments, get_assignment, create_assignment, update_assignment, delete_assignment,
duplicate_assignment, bulk_update_assignment_dates, list_assignment_overrides,
get_assignment_override, create_assignment_override, update_assignment_override,
delete_assignment_override

# Authentication Provider Tools (8)
list_authentication_providers, get_authentication_provider, create_authentication_provider,
update_authentication_provider, delete_authentication_provider, restore_authentication_provider,
get_sso_settings, update_sso_settings

# Course Tools (12)
list_courses, get_course, create_course, update_course, delete_course, list_course_users,
get_course_user, get_user_progress, get_course_settings, update_course_settings

# Enrollment Tools (17)
list_enrollments, get_enrollment, create_enrollment, update_enrollment, accept_enrollment,
reject_enrollment, reactivate_enrollment, add_last_attended_date, get_temporary_enrollment_status,
bulk_create_enrollments, get_active_students, get_course_teachers, get_pending_enrollments,
enroll_students, remove_enrollments

# External Tool Tools (14)
list_external_tools, get_external_tool, create_external_tool, update_external_tool,
delete_external_tool, get_sessionless_launch, add_rce_favorite, remove_rce_favorite,
add_top_nav_favorite, remove_top_nav_favorite, get_visible_course_nav_tools,
get_visible_course_nav_tools_for_course

# Grade Change Log Tools (5)
query_grade_changes_by_assignment, query_grade_changes_by_course, query_grade_changes_by_student,
query_grade_changes_by_grader, query_grade_changes_advanced

# Grading Standard Tools (3)
create_grading_standard, list_grading_standards, get_grading_standard

# Login Tools (5)
list_user_logins, create_user_login, update_user_login, delete_user_login, forgot_password

# LTI Launch Definition Tools (1)
list_lti_launch_definitions

# Module Tools (22)
list_modules, get_module, create_module, update_module, delete_module, relock_module,
list_module_items, get_module_item, create_module_item, update_module_item, delete_module_item,
mark_module_item_done, mark_module_item_not_done, mark_module_item_read, get_module_item_sequence,
select_mastery_path, list_module_overrides, update_module_overrides

# Page Tools (24)
list_course_pages, get_course_page, create_course_page, update_course_page, delete_course_page,
duplicate_course_page, get_course_front_page, update_course_front_page, list_course_page_revisions,
get_course_page_revision, revert_course_page_to_revision, list_group_pages, get_group_page,
create_group_page, update_group_page, delete_group_page, get_group_front_page,
update_group_front_page, list_group_page_revisions, get_group_page_revision,
revert_group_page_to_revision

# Quiz Tools (14)
list_quizzes, get_quiz, create_quiz, update_quiz, delete_quiz, reorder_quiz_items,
validate_quiz_access_code, list_quiz_questions, get_quiz_question, create_quiz_question,
update_quiz_question, delete_quiz_question

# Submission Tools (23)
submit_assignment, list_assignment_submissions, list_submissions_for_multiple_assignments,
get_submission, get_submission_by_anonymous_id, grade_submission, grade_submission_by_anonymous_id,
list_gradeable_students, list_multiple_assignments_gradeable_students, bulk_update_grades,
bulk_update_grades_for_course, mark_submission_as_read, mark_submission_as_unread,
mark_bulk_submissions_as_read, mark_submission_item_as_read, get_submission_summary,
get_gradebook_history_days, get_gradebook_history_day_details, get_gradebook_history_submissions,
get_gradebook_history_feed

# User Tools (37)
list_account_users, get_user, create_user, update_user, get_user_profile, list_avatar_options,
list_page_views, get_activity_stream, get_activity_stream_summary, get_todo_items,
get_todo_item_count, get_upcoming_events, get_missing_submissions, hide_stream_item,
hide_all_stream_items, get_user_settings, update_user_settings, get_custom_colors,
get_custom_color, update_custom_color, update_text_editor_preference,
update_files_ui_version_preference, get_dashboard_positions, update_dashboard_positions,
terminate_all_sessions, expire_mobile_sessions, merge_user, split_user, get_graded_submissions,
store_custom_data, load_custom_data, delete_custom_data, list_course_nicknames,
get_course_nickname, set_course_nickname, remove_course_nickname, clear_course_nicknames,
upload_user_file, get_pandata_events_token
```

</details>


<details>
<summary><strong>🔍 Elasticsearch Server</strong> - Search, analytics, and document management</summary>

### [Elasticsearch Server](servers/elasticsearch/README.md)

**Package:** `@crsiebler/mcp-elasticsearch-server`

**Description:** Comprehensive Elasticsearch integration for search, analytics, and document management with built-in data limiting controls.

**Quick Setup:**

- `ELASTICSEARCH_NODE` - Elasticsearch node URL (default: http://localhost:9200)
- `ELASTICSEARCH_USERNAME` and `ELASTICSEARCH_PASSWORD` - Basic authentication (optional)
- `ELASTICSEARCH_API_KEY` - API key authentication (optional)

**Key Features:** Full-text search with query DSL, aggregations and analytics, index management, document CRUD operations, bulk operations with safety limits, cluster health monitoring, and comprehensive data limiting controls.

**Available Tools (19):**

```
elasticsearch_test_connection, elasticsearch_cluster_health, elasticsearch_node_stats,
elasticsearch_list_indices, elasticsearch_get_index_info, elasticsearch_create_index,
elasticsearch_delete_index, elasticsearch_index_exists, elasticsearch_search,
elasticsearch_count, elasticsearch_aggregation, elasticsearch_get_document,
elasticsearch_index_document, elasticsearch_update_document, elasticsearch_delete_document,
elasticsearch_bulk_operation, elasticsearch_delete_by_query, elasticsearch_reindex
```

</details>

## Development

- [Server development](docs/server-development.md): extension points, build commands,
  generated outputs, and release boundaries.
- [Architecture](docs/architecture.md): request flow, shared helpers, and configuration.
- [Testing](docs/testing.md): command selection, prerequisites, and coverage limits.

Build one server with `npm run build -- --server=postgresql`, or all servers with
`npm run build -- --server=all`. Without arguments, the build opens an interactive
menu. Building does not start a server.

## Runtime diagnostics

Logging and error behavior vary by server. See [architecture](docs/architecture.md)
for shared logger behavior and inspect the selected server's entry point for its
actual diagnostics. This map does not establish shared health endpoints or metrics.

## Contributing

Read [AGENTS.md](AGENTS.md), make scoped changes on a feature branch, and run the
relevant checks from [testing](docs/testing.md). Use
`<type>(<scope>): <description>` for authorized commits. Preserve upstream
attribution and review package identity separately from code changes.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- Create an issue for bug reports or feature requests
- Check existing documentation in individual server README files
- Review the shared utilities documentation for development guidance
