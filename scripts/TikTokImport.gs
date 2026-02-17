/**
 * TikTok Data Importer for Google Sheets
 * Automatically processes TikTok data and updates product sheet tabs
 */

// Configuration - Product mappings
const PRODUCT_CONFIG = {
  '7419818437414005546': { name: 'Toner Pads', sheet: 'Toner Pads', row: 6 },
  '7430428456046265130': { name: 'Toner Pads - 2 Pack', sheet: 'Toner Pads - 2 Pack', row: 6 },
  '7430429110278006570': { name: 'Toner Pads - 3 Pack', sheet: 'Toner Pads - 3 Pack', row: 6 },
  '7432542736637593387': { name: "NAD+ Cream", sheet: 'NAD+ Cream', row: 6 },
  '7444135695883462442': { name: 'Toner Pads & NAD+ Bundle', sheet: 'Toner Pads & NAD+ Bundle', row: 6 }
};

// Column indices for source data (0-indexed)
const SOURCE_COLS = {
  DATE: 0,
  PRODUCT_ID: 1,
  GMV: 2,
  ORDERS: 3,
  ITEMS_SOLD: 4,
  VISITORS: 5,
  CUSTOMERS: 6,
  PRODUCT_IMPRESSIONS: 7,
  PAGE_VIEWS: 8,
  SUBSCRIBERS: 9
};

// Target column indices where data will be written (0-indexed, starting from column C = 2)
const TARGET_START_COL = 2; // Column C

/**
 * Creates custom menu on spreadsheet open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('TikTok Importer')
    .addItem('Import TikTok Data', 'importTikTokData')
    .addItem('Clear All Product Data', 'clearAllProductData')
    .addToUi();
}

/**
 * Main import function - reads TikTok data and updates all product sheets
 */
function importTikTokData() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Prompt user for source sheet name
  const response = ui.prompt(
    'Import TikTok Data',
    'Enter the name of the sheet with TikTok data:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const sourceSheetName = response.getResponseText();
  const sourceSheet = ss.getSheetByName(sourceSheetName);
  
  if (!sourceSheet) {
    ui.alert('Error', `Sheet "${sourceSheetName}" not found!`, ui.ButtonSet.OK);
    return;
  }
  
  try {
    // Read all data from source sheet (skip header row)
    const dataRange = sourceSheet.getDataRange();
    const data = dataRange.getValues();
    const headers = data[0];
    const rows = data.slice(1); // Skip header
    
    Logger.log(`Found ${rows.length} rows of data`);
    
    // Group data by product ID
    const productData = groupDataByProduct(rows);
    
    // Process each product
    let updatedCount = 0;
    for (const [productId, records] of Object.entries(productData)) {
      const config = PRODUCT_CONFIG[productId];
      
      if (!config) {
        Logger.log(`No configuration found for product ID: ${productId}`);
        continue;
      }
      
      // Update the product sheet
      const success = updateProductSheet(ss, config, records);
      if (success) {
        updatedCount++;
      }
    }
    
    ui.alert(
      'Import Complete',
      `Successfully updated ${updatedCount} product sheet(s).`,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log(`Error importing data: ${error.toString()}`);
    ui.alert('Error', `Failed to import data: ${error.toString()}`, ui.ButtonSet.OK);
  }
}

/**
 * Groups data rows by product ID
 */
function groupDataByProduct(rows) {
  const grouped = {};
  
  for (const row of rows) {
    const productId = String(row[SOURCE_COLS.PRODUCT_ID]).trim();
    
    if (!productId || productId === '') continue;
    
    if (!grouped[productId]) {
      grouped[productId] = [];
    }
    
    grouped[productId].push({
      date: row[SOURCE_COLS.DATE],
      gmv: parseFloat(row[SOURCE_COLS.GMV]) || 0,
      orders: parseFloat(row[SOURCE_COLS.ORDERS]) || 0,
      items_sold: parseFloat(row[SOURCE_COLS.ITEMS_SOLD]) || 0,
      visitors: parseFloat(row[SOURCE_COLS.VISITORS]) || 0,
      customers: parseFloat(row[SOURCE_COLS.CUSTOMERS]) || 0,
      product_impressions: parseFloat(row[SOURCE_COLS.PRODUCT_IMPRESSIONS]) || 0,
      page_views: parseFloat(row[SOURCE_COLS.PAGE_VIEWS]) || 0,
      subscribers: parseFloat(row[SOURCE_COLS.SUBSCRIBERS]) || 0
    });
  }
  
  return grouped;
}

/**
 * Updates a product sheet with calculated metrics
 */
function updateProductSheet(ss, config, records) {
  const sheet = ss.getSheetByName(config.sheet);
  
  if (!sheet) {
    Logger.log(`Sheet "${config.sheet}" not found!`);
    return false;
  }
  
  Logger.log(`Updating ${config.sheet} with ${records.length} records`);
  
  // Sort records by date
  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Prepare data arrays for each metric (13 metrics total)
  const itemsSoldData = [];
  const gmvData = [];
  const ordersData = [];
  const aovData = [];
  const unitsPerOrderData = [];
  const productImpressionsData = [];
  const pageViewsData = [];
  const clickThroughRateData = [];
  const visitorsData = [];
  const customersData = [];
  const conversionRateData = [];
  const dollarPerVisitorData = [];
  const dollarPerCustomerData = [];
  const subscribersData = [];
  
  for (const record of records) {
    // Raw metrics
    itemsSoldData.push(record.items_sold);
    gmvData.push(record.gmv);
    ordersData.push(record.orders);
    productImpressionsData.push(record.product_impressions);
    pageViewsData.push(record.page_views);
    visitorsData.push(record.visitors);
    customersData.push(record.customers);
    subscribersData.push(record.subscribers);
    
    // Calculated metrics
    const aov = record.orders > 0 ? record.gmv / record.orders : 0;
    aovData.push(aov);
    
    const unitsPerOrder = record.orders > 0 ? record.items_sold / record.orders : 0;
    unitsPerOrderData.push(unitsPerOrder);
    
    const clickThroughRate = record.product_impressions > 0 
      ? (record.page_views / record.product_impressions) * 100 
      : 0;
    clickThroughRateData.push(clickThroughRate);
    
    const conversionRate = record.visitors > 0 
      ? (record.orders / record.visitors) * 100 
      : 0;
    conversionRateData.push(conversionRate);
    
    const dollarPerVisitor = record.visitors > 0 ? record.gmv / record.visitors : 0;
    dollarPerVisitorData.push(dollarPerVisitor);
    
    const dollarPerCustomer = record.customers > 0 ? record.gmv / record.customers : 0;
    dollarPerCustomerData.push(dollarPerCustomer);
  }
  
  // Write data to sheet starting at configured row
  const startRow = config.row;
  const startCol = TARGET_START_COL;
  
  // Row offsets for each metric (based on your sheet structure)
  const METRIC_ROWS = {
    ITEMS_SOLD: 0,          // Row 6
    GMV: 5,                 // Row 11
    ORDERS: 8,              // Row 14
    AOV: 9,                 // Row 15
    UNITS_PER_ORDER: 10,    // Row 16
    PRODUCT_IMPRESSIONS: 12, // Row 18
    PAGE_VIEWS: 13,         // Row 19
    CLICK_THROUGH_RATE: 14, // Row 20
    VISITORS: 16,           // Row 22
    CUSTOMERS: 17,          // Row 23
    CONV_RATE: 18,          // Row 24
    DOLLAR_PER_VISITOR: 21, // Row 27
    DOLLAR_PER_CUSTOMER: 22, // Row 28
    SUBSCRIBERS: 24         // Row 30
  };
  
  // Write each metric to its row
  writeDataRow(sheet, startRow + METRIC_ROWS.ITEMS_SOLD, startCol, itemsSoldData);
  writeDataRow(sheet, startRow + METRIC_ROWS.GMV, startCol, gmvData);
  writeDataRow(sheet, startRow + METRIC_ROWS.ORDERS, startCol, ordersData);
  writeDataRow(sheet, startRow + METRIC_ROWS.AOV, startCol, aovData);
  writeDataRow(sheet, startRow + METRIC_ROWS.UNITS_PER_ORDER, startCol, unitsPerOrderData);
  writeDataRow(sheet, startRow + METRIC_ROWS.PRODUCT_IMPRESSIONS, startCol, productImpressionsData);
  writeDataRow(sheet, startRow + METRIC_ROWS.PAGE_VIEWS, startCol, pageViewsData);
  writeDataRow(sheet, startRow + METRIC_ROWS.CLICK_THROUGH_RATE, startCol, clickThroughRateData);
  writeDataRow(sheet, startRow + METRIC_ROWS.VISITORS, startCol, visitorsData);
  writeDataRow(sheet, startRow + METRIC_ROWS.CUSTOMERS, startCol, customersData);
  writeDataRow(sheet, startRow + METRIC_ROWS.CONV_RATE, startCol, conversionRateData);
  writeDataRow(sheet, startRow + METRIC_ROWS.DOLLAR_PER_VISITOR, startCol, dollarPerVisitorData);
  writeDataRow(sheet, startRow + METRIC_ROWS.DOLLAR_PER_CUSTOMER, startCol, dollarPerCustomerData);
  writeDataRow(sheet, startRow + METRIC_ROWS.SUBSCRIBERS, startCol, subscribersData);
  
  Logger.log(`Successfully updated ${config.sheet}`);
  return true;
}

/**
 * Writes a single row of data to the sheet
 */
function writeDataRow(sheet, row, startCol, data) {
  if (data.length === 0) return;
  
  // Convert data to 2D array for setValues
  const rowData = [data];
  
  // Write to sheet
  sheet.getRange(row, startCol, 1, data.length).setValues(rowData);
}

/**
 * Clears all product data from all configured sheets
 */
function clearAllProductData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear All Data',
    'Are you sure you want to clear all product data? This cannot be undone.',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  for (const config of Object.values(PRODUCT_CONFIG)) {
    const sheet = ss.getSheetByName(config.sheet);
    if (sheet) {
      // Clear data range (keeping headers)
      const lastCol = sheet.getLastColumn();
      if (lastCol > TARGET_START_COL) {
        sheet.getRange(config.row, TARGET_START_COL, 30, lastCol - TARGET_START_COL + 1).clearContent();
      }
    }
  }
  
  ui.alert('Success', 'All product data cleared.', ui.ButtonSet.OK);
}
