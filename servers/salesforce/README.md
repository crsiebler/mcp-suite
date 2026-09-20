# Salesforce MCP Server

A Model Context Protocol (MCP) server for Salesforce CRM operations using REST APIs. This server provides CRUD (Create, Read, Update, Delete) operations for Salesforce objects.

## Installation & Usage

### Option 1: npm Package (Recommended)

```bash
# Install globally
npm install -g @crsiebler/mcp-salesforce-server

# Or run directly with npx
npx @crsiebler/mcp-salesforce-server
```

### Option 2: Build from Source

```bash
# From project root
npm install
npm run build

# The server will be available at:
./dist/servers/salesforce/src/index.js
```

## Cline MCP Configuration

To use this server with Cline (VS Code extension), add the following to your Cline MCP settings:

**File Location:**

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Configuration:**

```json
{
  "mcpServers": {
    "salesforce-integration": {
      "command": "npx",
      "args": ["@crsiebler/mcp-salesforce-server"],
      "env": {
        "SALESFORCE_LOGIN_URL": "https://login.salesforce.com",
        "SALESFORCE_USERNAME": "your-username",
        "SALESFORCE_PASSWORD": "your-password",
        "SALESFORCE_SECURITY_TOKEN": "your-security-token"
      },
      "disabled": false,
      "alwaysAllow": ["query_records", "create_record", "update_record"]
    }
  }
}
```

## Features

- **OAuth Authentication**: Automatic token management with persistence and auto-renewal
- **Query**: Execute SOQL queries to retrieve records
- **Create**: Create new records in any Salesforce object
- **Read**: Retrieve specific records by ID
- **Update**: Update existing records
- **Delete**: Delete records from Salesforce
- **Describe**: Get metadata information about Salesforce objects
- **List Objects**: List all available Salesforce object types
- **Auto Re-authentication**: Automatically refreshes expired tokens

## Configuration

### OAuth Authentication (Required)

Set OAuth environment variables for automatic authentication:

```bash
export SALESFORCE_CLIENT_ID="your_connected_app_client_id"
export SALESFORCE_CLIENT_SECRET="your_connected_app_client_secret"
export SALESFORCE_USERNAME="your_salesforce_username"
export SALESFORCE_PASSWORD="your_password_with_security_token"
export SALESFORCE_GRANT_TYPE="password"  # Optional, defaults to "password"
export SALESFORCE_LOGIN_URL="https://login.salesforce.com"  # Optional, defaults to production
```

**Automatic Authentication**: The server automatically authenticates on the first API call and handles token management transparently. Access tokens are stored in environment variables (`SALESFORCE_ACCESS_TOKEN` and `SALESFORCE_INSTANCE_URL`) and automatically renewed when they expire.

**Setting up a Connected App:**

1. Go to Setup → App Manager → New Connected App
2. Enable OAuth Settings
3. Add OAuth Scopes: `Full access (full)` or specific scopes
4. Set Callback URL (can be placeholder for username-password flow)
5. Note down Consumer Key (Client ID) and Consumer Secret (Client Secret)

## Usage

**Note**: All tools automatically handle authentication using the environment variables above. No manual authentication is required.

### Query Records

Execute SOQL queries to retrieve data:

```json
{
  "tool": "salesforce_query",
  "soql": "SELECT Id, Name, Email FROM Contact WHERE AccountId != null LIMIT 10"
}
```

### Create Records

Create new records in Salesforce:

```json
{
  "tool": "salesforce_create",
  "sobject_type": "Account",
  "record": {
    "Name": "New Account",
    "Industry": "Technology",
    "Phone": "555-1234"
  }
}
```

### Read Records

Retrieve specific records by ID:

```json
{
  "tool": "salesforce_read",
  "sobject_type": "Account",
  "id": "0013D00000AbCdEf",
  "fields": ["Id", "Name", "Industry", "Phone"]
}
```

### Update Records

Update existing records:

```json
{
  "tool": "salesforce_update",
  "sobject_type": "Account",
  "id": "0013D00000AbCdEf",
  "record": {
    "Phone": "555-5678",
    "Industry": "Finance"
  }
}
```

### Delete Records

Delete records from Salesforce:

```json
{
  "tool": "salesforce_delete",
  "sobject_type": "Account",
  "id": "0013D00000AbCdEf"
}
```

### Describe Objects

Get metadata information about Salesforce objects:

```json
{
  "tool": "salesforce_describe",
  "sobject_type": "Account"
}
```

### List Available Objects

List all available Salesforce object types (returns only object names):

```json
{
  "tool": "salesforce_list_objects"
}
```

**Note**: This tool returns only the object names (e.g., "Account", "Contact", "Opportunity") for efficiency. Use `salesforce_describe` with a specific object name to get detailed metadata.

## Common Salesforce Objects

- **Account**: Companies and organizations
- **Contact**: People associated with accounts
- **Lead**: Potential customers
- **Opportunity**: Sales deals
- **Case**: Customer service cases
- **Task**: Activities and to-dos
- **Event**: Calendar events and meetings
- **User**: Salesforce users
- **Campaign**: Marketing campaigns

## Error Handling

The server provides detailed error messages for common issues:

- Invalid SOQL syntax
- Missing required fields
- Permission errors
- Record not found
- Field validation errors

## Security

- Uses Salesforce REST API with OAuth authentication
- All operations respect Salesforce field-level security
- Object-level permissions are enforced by Salesforce
- Access token should be kept secure and rotated regularly

## Limitations

- Requires valid Salesforce access token
- Subject to Salesforce API rate limits
- Large query results may be truncated (use LIMIT clause)
- Binary data and attachments require special handling

## Bulk deletion result contract

`salesforce_bulk_delete` keeps its arguments: `sobject_type`, `ids` (1–200 IDs),
and optional `all_or_none` (boolean, default false). IDs must be 15 or 18 ASCII
alphanumeric characters. `sobject_type` is retained for compatibility; the
Collections endpoint selects records from their IDs, so it does not restrict
those IDs to the named object type. Keep explicit host approval for deletion.

Salesforce returns an ordered array of DeleteResult objects. HTTP 200 alone does
not mean every record was deleted. With `all_or_none: false`, successful records
can be deleted even when others fail; with true, any failure rolls back the
standalone Collections request. This server does not wrap it in an outer Composite
transaction. [Salesforce Collections deletion](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections_delete.htm)

Migration: the old implementation returned the provider array under `data` while
checking a nonexistent `response.results` property. The corrected response uses
`data.results` and reports `success: false` for any per-record failure. MCP
`isError` is also true for bulk-delete failures; other Salesforce tool envelopes
are unchanged.

`data` contains:

- `results`: in input order, with `requestedId`, optional provider `id`, `success`
  and an `errors` array containing provider `statusCode` values. Provider IDs may
  be absent/null for failed records; `requestedId` identifies the affected input.
- `allOrNone` and `rolledBack`: requested transaction behavior and whether a
  valid failure response indicates the all-or-none request was rolled back.
- `deletedCount` and `failedCount`: outcomes from the validated per-record results;
  rolled-back rows count as failed, not deleted.

Raw provider error messages/field values are omitted from this response; use the
status codes and requested IDs for investigation. Malformed, missing, reordered
or contradictory results return a safe failure without invented record outcomes.
Network/provider failures also report uncertainty: inspect records before
retrying any deletion. No new automatic retries or authentication changes are
introduced; the existing authentication/refresh behavior remains in place.

Offline fixtures cover arrays, partial failures, all-or-none rollback, invalid
responses, input boundaries and the 200-record limit. Packaged checks verify the
bulk tool's MCP error flag. These checks make no live Salesforce deletion and do
not prove permissions or transaction enforcement against a real organization.
