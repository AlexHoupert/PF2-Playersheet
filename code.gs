function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. FETCH CHARACTER DATA
  const charSheet = ss.getSheetByName("Character"); 
  let charData = {};

  if (charSheet) {
    const charDataRaw = charSheet.getDataRange().getValues();
    charDataRaw.forEach(row => {
      const key = (row[0] || "").toString().trim();
      if (!key) return; // skip blank rows to avoid stray "" keys

      let val = row[1];
      if (typeof val === 'string' && (val.trim().startsWith('[') || val.trim().startsWith('{'))) {
        try { val = JSON.parse(val); } catch(e) { /* keep as string */ }
      }
      charData[key] = val;
    });
  }

  // 2. HELPER: SMART TAB READER
  function getRefTab(tabName) {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return {}; 
    
    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return {}; 

    const headers = rows[0].map(h => h.toString().toLowerCase().trim());
    const priceIdx = headers.indexOf("price");
    const nameIdx = 0; 
    
    let db = {};
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const key = row[nameIdx];
      if (!key) continue;

      let val = {};
      try { val = JSON.parse(row[1]); } catch (e) { val = { description: row[1] }; }
      if (priceIdx > -1) val.price = row[priceIdx];
      db[key] = val;
    }
    return db;
  }

  const response = {
    status: "success",
    character: charData,
    db: {
      feats: getRefTab("Feats"),
      rules: getRefTab("Rules"),
      consumables: getRefTab("Consumables"),
      equipment: getRefTab("Equipment"),
      conditions: getRefTab("Conditions")
    }
  };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const charSheet = ss.getSheetByName("Character");
    const charValues = charSheet.getDataRange().getValues();

    function findRow(key) {
      for (let i = 0; i < charValues.length; i++) {
        if (charValues[i][0] == key) return i + 1;
      }
      return -1;
    }

    // --- GENERIC NUMERIC MODIFIER (Add/Sub) ---
    // Used for Gold, HP, Temp HP math on server
    if (data.action === "modify_stat") {
      const row = findRow(data.key);
      if (row === -1) return responseJSON({status: "error", message: "Key not found"});

      // Get current value safely
      let currentVal = parseFloat(charSheet.getRange(row, 2).getValue()) || 0;
      let changeAmount = parseFloat(data.amount) || 0;
      
      let newVal = currentVal + changeAmount;
      
      // Optional: Prevent negatives for specific stats if needed, but usually frontend handles this
      // if (newVal < 0 && data.key !== "HP_Temp") newVal = 0; 

      charSheet.getRange(row, 2).setValue(newVal);
      return responseJSON({status: "success", newVal: newVal});
    }

    // --- GENERIC SETTER (Set) ---
    // Used for setting Gold/HP directly to a number
    if (data.action === "set_stat") {
      const row = findRow(data.key);
      if (row > 0) {
        charSheet.getRange(row, 2).setValue(data.value);
        return responseJSON({status: "success"});
      }
    }

    // --- INVENTORY LOGIC ---
    if (data.action === "buy_item") {
      // 1. Deduct Gold
      const goldRow = findRow("Gold");
      let currentGold = charSheet.getRange(goldRow, 2).getValue();
      if (data.price > 0) {
        if (currentGold < data.price) return responseJSON({status: "error", message: "Not enough gold!"});
        charSheet.getRange(goldRow, 2).setValue(currentGold - data.price);
      }

      // 2. Add Item
      const targetField = data.targetField || "Inventory_Consumables";
      const invRow = findRow(targetField);
      let currentInvRaw = charSheet.getRange(invRow, 2).getValue();
      let currentInv = [];
      try { currentInv = JSON.parse(currentInvRaw); } catch(e) {}
      if (!Array.isArray(currentInv)) currentInv = [];

      let existingItem = currentInv.find(i => i.name === data.itemName);
      if (existingItem) {
        existingItem.qty = (existingItem.qty || 1) + 1;
      } else {
        currentInv.push({ name: data.itemName, qty: 1 });
      }

      charSheet.getRange(invRow, 2).setValue(JSON.stringify(currentInv));
      return responseJSON({status: "success"});
    }

    if (data.action === "adjust_qty") {
      const targetField = data.targetField || "Inventory_Consumables";
      const invRow = findRow(targetField);
      let currentInvRaw = charSheet.getRange(invRow, 2).getValue();
      let currentInv = [];
      try { currentInv = JSON.parse(currentInvRaw); } catch(e) {}

      let existingItem = currentInv.find(i => i.name === data.itemName);
      if (existingItem) {
        existingItem.qty = (parseInt(existingItem.qty) || 0) + data.delta;
        if (existingItem.qty <= 0) {
           currentInv = currentInv.filter(i => i.name !== data.itemName);
        }
      }
      charSheet.getRange(invRow, 2).setValue(JSON.stringify(currentInv));
      return responseJSON({status: "success"});
    }

    return responseJSON({status: "error", message: "Unknown action"});

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
