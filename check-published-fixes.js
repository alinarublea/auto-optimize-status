#!/usr/bin/env node
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const SITE_ID = 'da39921f-9a02-41db-b491-02c98330d956'; // TODO: Replace with your actual site ID
const OPPORTUNITY_ID = '11b15245-88ae-4cad-bdb8-54cd55764f19';// TODO: Replace with your actual opportunity ID
const { SPACECAT_API_KEY } = process.env;
const { HELIX_ADMIN_TOKEN } = process.env;

if (!SPACECAT_API_KEY) {
  console.error('Error: SPACECAT_API_KEY environment variable is required');
  process.exit(1);
}

if (!HELIX_ADMIN_TOKEN) {
  console.error('Error: HELIX_ADMIN_TOKEN environment variable is required');
  process.exit(1);
}

/**
 * Fetches the site details from SpaceCat API
 * @returns {Promise<Object>} Site details including RSO configuration
 */
async function getSiteDetails() {
  const url = `https://spacecat.experiencecloud.live/api/v1/sites/${SITE_ID}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-api-key': SPACECAT_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch site details: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching site details:', error.message);
    throw error;
  }
}

/**
 * Fetches the fixed pages from SpaceCat API
 * @returns {Promise<Array>} Array of fix entries
 */
async function getFixedPages() {
  const url = `https://spacecat.experiencecloud.live/api/v1/sites/${SITE_ID}/opportunities/${OPPORTUNITY_ID}/fixes`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-api-key': SPACECAT_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch fixes: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching fixed pages:', error.message);
    throw error;
  }
}

/**
 * Gets the status of a document from Helix admin API
 * @param {string} documentPath - The document path
 * @param {Object} rso - RSO configuration from site details
 * @returns {Promise<Object>} Status response
 */
async function getHelixStatus(documentPath, rso) {
  // Remove leading slashes from path
  const cleanPath = documentPath.replace(/^\/+/, '');
  const adminEndpointUrl = `https://admin.hlx.page/status/${rso.owner}/${rso.site}/${rso.ref}/${cleanPath}`;

  try {
    const response = await fetch(adminEndpointUrl, {
      headers: {
        Authorization: `token ${HELIX_ADMIN_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch status for ${documentPath}: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching status for ${documentPath}:`, error.message);
    return null;
  }
}

/**
 * Parses a date string and returns a Date object
 * @param {string} dateString - ISO date string
 * @returns {Date} Parsed date
 */
function parseDate(dateString) {
  return new Date(dateString);
}

/**
 * Checks if a date is after another date
 * @param {string} dateString1 - First date string
 * @param {string} dateString2 - Second date string
 * @returns {boolean} True if dateString1 > dateString2
 */
function isDateAfter(dateString1, dateString2) {
  const date1 = parseDate(dateString1);
  const date2 = parseDate(dateString2);
  return date1 > date2;
}

/**
 * Main function to check published fixes
 */
async function checkPublishedFixes() {
  console.log('Fetching site details and fixed pages...');

  try {
    // Step 1: Get site details to extract RSO configuration
    const siteDetails = await getSiteDetails();
    const rso = siteDetails.hlxConfig?.rso;

    if (!rso) {
      throw new Error('Site does not have RSO configuration in hlxConfig');
    }

    console.log(`Using RSO config: ${rso.owner}/${rso.site}/${rso.ref}`);

    // Step 2: Get fixed pages
    const fixes = await getFixedPages();
    console.log(`Found ${fixes.length} total fixes`);

    // Step 3: Filter for DEPLOYED fixes and extract relevant data
    const deployedFixes = fixes
      .filter((fix) => fix.status === 'DEPLOYED')
      .map((fix) => ({
        id: fix.id,
        executedAt: fix.executedAt,
        documentPath: fix.changeDetails?.documentPath,
      }))
      .filter((fix) => fix.documentPath); // Only include fixes with documentPath

    console.log(`Found ${deployedFixes.length} deployed fixes with document paths`);

    if (deployedFixes.length === 0) {
      console.log('No deployed fixes with document paths found.');
      return;
    }

    // Step 4: Check status for each document
    const livePublishedPages = [];
    const previewPublishedPages = [];

    console.log('\nChecking publication status for each page...');

    for (const fix of deployedFixes) {
      console.log(`\nChecking ${fix.documentPath} (executed at: ${fix.executedAt})`);

      const status = await getHelixStatus(fix.documentPath, rso);

      if (!status) {
        console.log('  ❌ Failed to get status');
        continue;
      }

      // Check live status
      if (status.live?.lastModified) {
        if (isDateAfter(status.live.lastModified, fix.executedAt)) {
          console.log(`  ✅ Live published after fix (${status.live.lastModified})`);
          livePublishedPages.push({
            documentPath: fix.documentPath,
            executedAt: fix.executedAt,
            liveLastModified: status.live.lastModified,
            liveUrl: status.live.url,
          });
        } else {
          console.log(`  ⏳ Live not updated since fix (${status.live.lastModified})`);
        }
      } else {
        console.log('  ❌ No live version available');
      }

      // Check preview status
      if (status.preview?.lastModified) {
        if (isDateAfter(status.preview.lastModified, fix.executedAt)) {
          console.log(`  ✅ Preview published after fix (${status.preview.lastModified})`);
          previewPublishedPages.push({
            documentPath: fix.documentPath,
            executedAt: fix.executedAt,
            previewLastModified: status.preview.lastModified,
            previewUrl: status.preview.url,
          });
        } else {
          console.log(`  ⏳ Preview not updated since fix (${status.preview.lastModified})`);
        }
      } else {
        console.log('  ❌ No preview version available');
      }

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Step 5: Report results
    console.log(`\n${'='.repeat(80)}`);
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n📊 LIVE PUBLISHED PAGES (${livePublishedPages.length}):`);
    if (livePublishedPages.length > 0) {
      livePublishedPages.forEach((page) => {
        console.log(`  • ${page.documentPath}`);
        console.log(`    Fix executed: ${page.executedAt}`);
        console.log(`    Live published: ${page.liveLastModified}`);
        console.log(`    Live URL: ${page.liveUrl}\n`);
      });
    } else {
      console.log('  None found.\n');
    }

    console.log(`📋 PREVIEW PUBLISHED PAGES (${previewPublishedPages.length}):`);
    if (previewPublishedPages.length > 0) {
      previewPublishedPages.forEach((page) => {
        console.log(`  • ${page.documentPath}`);
        console.log(`    Fix executed: ${page.executedAt}`);
        console.log(`    Preview published: ${page.previewLastModified}`);
        console.log(`    Preview URL: ${page.previewUrl}\n`);
      });
    } else {
      console.log('  None found.\n');
    }

    // Export results as arrays for programmatic use
    return {
      livePublishedPages: livePublishedPages.map((p) => p.documentPath),
      previewPublishedPages: previewPublishedPages.map((p) => p.documentPath),
      details: {
        live: livePublishedPages,
        preview: previewPublishedPages,
      },
    };
  } catch (error) {
    console.error('Error in checkPublishedFixes:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
checkPublishedFixes()
  .then((results) => {
    if (results) {
      console.log('\n📋 Summary Arrays:');
      console.log('Live published paths:', JSON.stringify(results.livePublishedPages, null, 2));
      console.log('Preview published paths:', JSON.stringify(results.previewPublishedPages, null, 2));
    }
  })
  .catch((error) => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
