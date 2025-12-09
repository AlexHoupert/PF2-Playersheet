// -----------------------------------------------------------------------
// PATHFINDER 2E SHEET BACKEND - FINAL COMBINED
// -----------------------------------------------------------------------

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  const response = {
    character: {},
    db: {}
  };

  // -------------------------------------------------
  // ROBUST DATA READER (Fixes empty Actions/Feats)
  // -------------------------------------------------
  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    const cleanName = sheetName.trim().toLowerCase();
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow < 1 || lastCol < 1) return; 

    // Get all data at once
    const rawData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    
    // 1. CHARACTER TAB (Vertical Key-Value)
    if (cleanName === "character" || cleanName === "stats") {
      rawData.forEach(row => {
        const key = String(row[0]).trim(); 
        const val = row[1];
        if (key) response.character[key] = val;
      });
      return;
    }

    // 2. DATABASE TABS (Horizontal Tables)
    // We assume Row 1 contains Headers
    const headers = rawData[0].map(h => String(h).trim().toLowerCase());
    const tableData = {};

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const itemName = String(row[0]).trim(); // Col A is Key
      
      if (itemName) {
        const itemObj = {};
        headers.forEach((header, colIndex) => {
          // Map header to value safely
          itemObj[header] = row[colIndex];
        });
        tableData[itemName] = itemObj;
      }
    }

    // Save under both lowercase and original name
    response.db[cleanName] = tableData;
    response.db[sheetName] = tableData;
  });

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------------------
// POST HANDLING (Writing data back to sheets)
// -----------------------------------------------------------------------
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s for other users

  try {
    const params = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const charSheet = ss.getSheetByName("Character");
    
    if (!charSheet) throw new Error("Character tab not found");

    const action = params.action;
    
    // --- HELPERS ---
    
    // Find the row number where Column A matches the key
    function findRow(key) {
      const data = charSheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === key) return i + 1;
      }
      return -1;
    }

    // Write data (Update existing or Append new)
    function writeData(key, val) {
      const row = findRow(key);
      // Ensure objects are stringified (like Inventory arrays)
      const storeVal = (typeof val === 'object') ? JSON.stringify(val) : val;
      
      if (row > 0) {
        charSheet.getRange(row, 2).setValue(storeVal);
      } else {
        charSheet.appendRow([key, storeVal]);
      }
    }

    // --- ACTIONS ---

    // 1. GENERIC SETTER (e.g., set gold directly)
    if (action === "set_stat") {
      writeData(params.key, params.value);
      return responseJSON({status: "success"});
    }

    // 2. GENERIC MODIFIER (e.g., add +5 to HP)
    if (action === "modify_stat") {
      const row = findRow(params.key);
      if (row > 0) {
        const currentVal = charSheet.getRange(row, 2).getValue();
        const newVal = (parseFloat(currentVal) || 0) + parseFloat(params.amount);
        charSheet.getRange(row, 2).setValue(newVal);
      } else {
        // If stat doesn't exist, start at 0 + amount
        charSheet.appendRow([params.key, params.amount]);
      }
      return responseJSON({status: "success"});
    }

    // 3. CONDITIONS
    if (action === "modify_condition") {
      const row = findRow("Conditions");
      let conditions = [];
      
      if (row > 0) {
        const val = charSheet.getRange(row, 2).getValue();
        try { conditions = JSON.parse(val); } catch(e) {}
      }
      if (!Array.isArray(conditions)) conditions = [];

      const existing = conditions.find(c => c.name === params.name);
      if (existing) {
        existing.level = params.level;
      } else {
        conditions.push({ name: params.name, level: params.level });
      }

      writeData("Conditions", conditions);
      return responseJSON({status: "success"});
    }

    // 4. BUY ITEM (Restored Logic)
    if (action === "buy_item") {
      // A. Deduct Gold
      if (params.price > 0) {
        const goldRow = findRow("Gold");
        if (goldRow > 0) {
          const currentGold = parseFloat(charSheet.getRange(goldRow, 2).getValue()) || 0;
          if (currentGold < params.price) {
             return responseJSON({status: "error", message: "Not enough gold"});
          }
          charSheet.getRange(goldRow, 2).setValue(currentGold - params.price);
        } else {
           // If no gold row exists, we assume 0 gold, so can't buy
           return responseJSON({status: "error", message: "No gold found on sheet"});
        }
      }

      // B. Add to Inventory
      const targetField = params.targetField || "Inventory_Consumables";
      const invRow = findRow(targetField);
      let list = [];
      
      if (invRow > 0) {
        try { list = JSON.parse(charSheet.getRange(invRow, 2).getValue()); } catch(e) {}
      }
      if (!Array.isArray(list)) list = [];

      let item = list.find(i => i.name === params.itemName);
      if (item) {
        item.qty = (parseInt(item.qty) || 1) + 1;
      } else {
        list.push({ name: params.itemName, qty: 1 });
      }

      writeData(targetField, list);
      return responseJSON({status: "success"});
    }

    // 5. ADJUST QUANTITY (Restored Logic)
    if (action === "adjust_qty") {
      const targetField = params.targetField || "Inventory_Consumables";
      const invRow = findRow(targetField);
      let list = [];

      if (invRow > 0) {
        try { list = JSON.parse(charSheet.getRange(invRow, 2).getValue()); } catch(e) {}
      }
      
      const item = list.find(i => i.name === params.itemName);
      if (item) {
        item.qty = (parseInt(item.qty) || 0) + params.delta;
        // Remove if 0 or less
        if (item.qty <= 0) {
          list = list.filter(i => i.name !== params.itemName);
        }
      }

      writeData(targetField, list);
      return responseJSON({status: "success"});
    }

    return responseJSON({status: "success"});

  } catch (err) {
    return responseJSON({status: "error", message: err.toString()});
  } finally {
    lock.releaseLock();
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}