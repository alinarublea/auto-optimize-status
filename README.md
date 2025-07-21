# Check Published Fixes Script

This script checks which fixed pages have been published (live or preview) after their fix execution time.

## Prerequisites

- Node.js (version 18 or higher with fetch support)
- SpaceCat API key
- Helix admin token for the publication status check, site specific

## Setup

1. Set the required environment variables:

```bash
export SPACECAT_API_KEY="your_spacecat_api_key_here"
export HELIX_ADMIN_TOKEN="your_helix_admin_token_here"
```

Or create a `.env` file:
```
SPACECAT_API_KEY=your_spacecat_api_key_here
HELIX_ADMIN_TOKEN=your_helix_admin_token_here
```

## Usage

Run the script:

```bash
node check-published-fixes.js
```

## What it does

1. **Fetches site details** from the SpaceCat API to get RSO configuration (owner/site/ref)
2. **Fetches fixed pages** from the SpaceCat API for a specific site and opportunity
3. **Filters for DEPLOYED fixes** and extracts the `executedAt` timestamp and `documentPath`
4. **Checks Helix status** for each document path using the admin API with dynamic RSO parameters
5. **Compares timestamps** to determine if pages were published after the fix was executed:
   - **Live published**: `live.lastModified > executedAt`
   - **Preview published**: `preview.lastModified > executedAt`
6. **Reports results** with detailed information and summary arrays

## Output

The script provides:

- **Console output** with detailed progress and results
- **Two arrays** of document paths:
  - `livePublishedPages`: Pages published to live after fix execution
  - `previewPublishedPages`: Pages published to preview after fix execution
- **Detailed objects** with timestamps and URLs for further analysis

## Configuration

The script is currently configured for:
- **Site ID**: `da39921f-9a02-41db-b491-02c98330d956`
- **Opportunity ID**: `11b15245-88ae-4cad-bdb8-54cd55764f19`

The repository details (owner/site/ref) are automatically fetched from the site's RSO configuration via the SpaceCat API.

To use with different sites/opportunities, update the `SITE_ID` and `OPPORTUNITY_ID` constants at the top of the script.

## Example Output

```
Fetching site details and fixed pages...
Using RSO config: bamboohr/bamboohr-website/main
Found 5 total fixes
Found 3 deployed fixes with document paths

Checking publication status for each page...

Checking /resources/hr-glossary/form-940 (executed at: 2025-07-11T15:28:23.948Z)
  ✅ Live published after fix (2025-07-11T16:30:00.000Z)
  ✅ Preview published after fix (2025-07-11T16:25:00.000Z)

================================================================================
RESULTS SUMMARY
================================================================================

📊 LIVE PUBLISHED PAGES (1):
  • /resources/hr-glossary/form-940
    Fix executed: 2025-07-11T15:28:23.948Z
    Live published: 2025-07-11T16:30:00.000Z
    Live URL: https://main--bamboohr-website--bamboohr.aem.live/resources/hr-glossary/form-940

📋 PREVIEW PUBLISHED PAGES (1):
  • /resources/hr-glossary/form-940
    Fix executed: 2025-07-11T15:28:23.948Z
    Preview published: 2025-07-11T16:25:00.000Z
    Preview URL: https://main--bamboohr-website--bamboohr.aem.page/resources/hr-glossary/form-940
```

## Return Values

The script returns an object with:

```javascript
{
  livePublishedPages: ["/page1", "/page2"],           // Array of document paths
  previewPublishedPages: ["/page1", "/page3"],        // Array of document paths  
  details: {
    live: [                                           // Detailed objects with timestamps
      {
        documentPath: "/page1",
        executedAt: "2025-07-11T15:28:23.948Z",
        liveLastModified: "2025-07-11T16:30:00.000Z",
        liveUrl: "https://..."
      }
    ],
    preview: [...]                                    // Similar structure for preview
  }
}
```

## Error Handling

The script includes robust error handling:
- Validates environment variables on startup
- Handles API failures gracefully
- Continues processing even if individual pages fail
- Provides detailed error messages for debugging

## Rate Limiting

The script includes a 100ms delay between API calls to be respectful to the Helix admin API. 
