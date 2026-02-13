// Google Apps Script for TikTok Data Import to Google Sheets
// This script reads TikTok data and updates all product tabs with calculated metrics

const PRODUCT_SHEETS = {
  "Toner Pads": "toner_1pack",
  "Toner Pads - 2 Pack": "toner_2pack",
  "Toner Pads - 3 Pack": "toner_3pack",
  "NAD+ Cream": "nad_cream",
  "Toner Pads & NAD+ Bundle": "toner_bundle",
}

// Column mappings - adjust these based on your sheet structure
const COLUMN_MAP = {
  date: "A",
  gmv: "B",
  orders: "C",
  items_sold: "D",
  visitors: "E",
  customers: "F",
  product_impressions: "G",
  page_views: "H",
  subscribers: "I",
  // Calculated columns
  conversion_rate: "J",
  aov: "K",
  units_per_order: "L",
  click_through_rate: "M",
  dollar_per_visitor: "N",
  dollar_per_customer: "O",
}

/**
 * Main function to process TikTok data and update all sheets
 */
function importTikTokDataToSheets() {
  try {
    Logger.log("[v0] Starting TikTok import to Google Sheets")
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sourceSheet = spreadsheet.getSheetByName("TikTok Data") // Change this to your data source sheet
    
    if (!sourceSheet) {
      Logger.log("[v0] Error: Could not find 'TikTok Data' sheet")
      return
    }

    // Get all data from source sheet
    const data = sourceSheet.getDataRange().getValues()
    Logger.log(`[v0] Read ${data.length} rows from source sheet`)

    // Parse source data
    const parsedData = parseSourceData(data)
    Logger.log(`[v0] Parsed data for ${Object.keys(parsedData).length} products`)

    // Update each product sheet
    for (const [sheetName, sheetId] of Object.entries(PRODUCT_SHEETS)) {
      const productData = parsedData[sheetName] || []
      
      if (productData.length === 0) {
        Logger.log(`[v0] No data for ${sheetName}, skipping`)
        continue
      }

      const sheet = spreadsheet.getSheetByName(sheetName)
      if (!sheet) {
        Logger.log(`[v0] Warning: Sheet '${sheetName}' not found`)
        continue
      }

      updateProductSheet(sheet, productData)
      Logger.log(`[v0] Updated ${sheetName} with ${productData.length} rows`)
    }

    Logger.log("[v0] TikTok import completed successfully")
    SpreadsheetApp.getUi().alert("TikTok data imported successfully!")

  } catch (error) {
    Logger.log(`[v0] Error: ${error}`)
    SpreadsheetApp.getUi().alert(`Error: ${error}`)
  }
}

/**
 * Parse source data and group by product
 */
function parseSourceData(data) {
  const result = {}

  // Assume first row is header, start from row 2
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const productName = row[0]?.toString().trim() // Column A = Product Name
    const dateStr = row[1]?.toString().trim() // Column B = Date
    const gmv = parseFloat(row[2]) || 0 // Column C = GMV
    const orders = parseFloat(row[3]) || 0 // Column D = Orders
    const items_sold = parseFloat(row[4]) || 0 // Column E = Items Sold
    const visitors = parseFloat(row[5]) || 0 // Column F = Visitors
    const customers = parseFloat(row[6]) || 0 // Column G = Customers
    const product_impressions = parseFloat(row[7]) || 0 // Column H = Impressions
    const page_views = parseFloat(row[8]) || 0 // Column I = Page Views
    const subscribers = parseFloat(row[9]) || 0 // Column J = Subscribers

    if (!productName || !dateStr) continue

    if (!result[productName]) {
      result[productName] = []
    }

    // Calculate derived metrics
    const conversion_rate = visitors > 0 ? (orders / visitors) * 100 : 0
    const aov = orders > 0 ? gmv / orders : 0
    const units_per_order = orders > 0 ? items_sold / orders : 0
    const click_through_rate = product_impressions > 0 ? (page_views / product_impressions) * 100 : 0
    const dollar_per_visitor = visitors > 0 ? gmv / visitors : 0
    const dollar_per_customer = customers > 0 ? gmv / customers : 0

    result[productName].push({
      date: dateStr,
      gmv,
      orders,
      items_sold,
      visitors,
      customers,
      product_impressions,
      page_views,
      subscribers,
      conversion_rate,
      aov,
      units_per_order,
      click_through_rate,
      dollar_per_visitor,
      dollar_per_customer,
    })
  }

  return result
}

/**
 * Update a product sheet with calculated data
 */
function updateProductSheet(sheet, productData) {
  // Sort by date
  productData.sort((a, b) => new Date(a.date) - new Date(b.date))

  // Find first data row (skip headers)
  let startRow = 2
  const existingData = sheet.getDataRange().getValues()
  
  if (existingData.length > 1 && existingData[0][0]) {
    // Check if row 1 looks like a header
    startRow = 2
  }

  // Prepare rows to insert/update
  const rows = productData.map(item => [
    item.date,
    item.gmv,
    item.orders,
    item.items_sold,
    item.visitors,
    item.customers,
    item.product_impressions,
    item.page_views,
    item.subscribers,
    item.conversion_rate.toFixed(2),
    item.aov.toFixed(2),
    item.units_per_order.toFixed(2),
    item.click_through_rate.toFixed(2),
    item.dollar_per_visitor.toFixed(2),
    item.dollar_per_customer.toFixed(2),
  ])

  // Clear existing data (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).clearContent()
  }

  // Write new data
  if (rows.length > 0) {
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows)
  }

  // Format numbers
  formatProductSheet(sheet, startRow, rows.length)
}

/**
 * Format numbers in product sheet
 */
function formatProductSheet(sheet, startRow, rowCount) {
  if (rowCount === 0) return

  const endRow = startRow + rowCount - 1

  // Currency columns: GMV (B), $ per Visitor (N), $ per Customer (O)
  sheet.getRange(`B${startRow}:B${endRow}`).setNumberFormat("$#,##0.00")
  sheet.getRange(`N${startRow}:O${endRow}`).setNumberFormat("$#,##0.00")

  // Percentage columns: Conversion Rate (J), Click-Through Rate (M)
  sheet.getRange(`J${startRow}:J${endRow}`).setNumberFormat("0.00\"%\"")
  sheet.getRange(`M${startRow}:M${endRow}`).setNumberFormat("0.00\"%\"")

  // Decimal columns: AOV (K), Units per Order (L)
  sheet.getRange(`K${startRow}:K${endRow}`).setNumberFormat("0.00")
  sheet.getRange(`L${startRow}:L${endRow}`).setNumberFormat("0.00")

  // Set column widths
  sheet.setColumnWidth(1, 120) // Date
  sheet.setColumnWidth(2, 100) // GMV
  sheet.setColumnWidths(3, 13, 80) // Orders through Dollar per Customer
}

/**
 * Create a menu to trigger the import
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TikTok Importer")
    .addItem("Import TikTok Data", "importTikTokDataToSheets")
    .addToUi()
}
