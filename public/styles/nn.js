// -----------------------------------------------------------------------------
// Section 1: Modal Handlers (Overlay, ESC, Close Buttons)
// -----------------------------------------------------------------------------

const addItemsModal = document.getElementById("addItemsModal");
const retrieveItemsModal = document.getElementById("retrieveItemsModal");
const addButton = document.getElementById("AddProduct");
const retrieveButton = document.getElementById("RetrieveProduct");

function openModal(modal) {
  modal.classList.add("show");
}

function closeModals() {
  if (addItemsModal) {
    addItemsModal.classList.remove("show");
    const addForm = document.getElementById("addForm");
    if(addForm) addForm.reset();
  }
  if (retrieveItemsModal) {
    retrieveItemsModal.classList.remove("show");
    
    const retrieveForm = document.getElementById("retrieveForm");
    if(retrieveForm) retrieveForm.reset();
    
    // Reset retrieve state
    const retrieveState = document.getElementById("retrieveState");
    if(retrieveState) {
      retrieveState.innerHTML = `
        <div class="empty-state">
          Enter a product name or SKU to locate it instantly
          <span class="small-note">⚡ O(1) Hash Lookup</span>
        </div>
      `;
    }
  }
}

// Open Handlers
if(addButton) {
  addButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openModal(addItemsModal);
  });
}

if(retrieveButton) {
  retrieveButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openModal(retrieveItemsModal);
  });
}

// Close on Overlay Click
const modals = document.querySelectorAll(".modal-overlay");
modals.forEach((modal) => {
  modal.addEventListener("click", (e) => {
    // Only close if clicking exactly on the overlay background, not the box inside
    if (e.target === modal) {
      closeModals();
    }
  });
});

// Close on Escape Key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModals();
  }
});

// -----------------------------------------------------------------------------
// Section 2: Submit Add Item (Single Batch)
// -----------------------------------------------------------------------------

function submitSingleBatch() {
  const name = document.getElementById("ProductName").value;
  const quant = document.getElementById("quant").value;
  const size = document.getElementById("size").value;
  const priority = document.getElementById("priority").value;
  const weight = document.getElementById("weight").value;
  const sku = document.getElementById("sku").value; // Used in UI only if backend unsupported
  const category = document.getElementById("category").value; // Used in UI only if backend unsupported

  if (!name || !quant || !size || !priority || !weight) {
    alert("Please fill all required fields.");
    return false;
  }

  // Formatting as batch of 1 product to securely match the backend's existing payload expectation
  const productArr = [{ name, quant: +quant, size: +size, priority, weight: +weight, sku, category }];
  
  document.getElementById("productsData").value = JSON.stringify(productArr);
  return true;
}

// -----------------------------------------------------------------------------
// Section 3: Retrieve Product API Request
// -----------------------------------------------------------------------------

const retrieveForm = document.getElementById("retrieveForm");
if(retrieveForm) {
  retrieveForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const form = e.target;
    // Check for FormData availability bounds
    const data = new FormData(form);
    const productName = data.get("productName");

    try {
      const res = await fetch("/retrieve-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName }),
      });

      const result = await res.json();
      const retrieveState = document.getElementById("retrieveState");

      if (result.success) {
        // Build the dynamic result card per user spec
        retrieveState.innerHTML = `
          <div class="result-card" style="display:block;">
            <div style="margin-bottom:8px;">
              <strong>${productName}</strong> 
              <span class="badge" style="background:${
                  result.priority === 'High' ? '#ef4444' : 
                  result.priority === 'Normal' || result.priority === 'Medium' ? '#f59e0b' : '#378ADD'
              }">${result.priority || "High"}</span>
            </div>
            
            <table style="width:100%; font-size:13px; color:#64748b;">
               <tr>
                 <td style="padding:4px 0;"><strong>Rack No:</strong> ${result.rackName || "N/A"}</td>
                 <td style="padding:4px 0;"><strong>Bin No:</strong> ${result.binName || "N/A"}</td>
               </tr>
               <tr>
                 <td style="padding:4px 0;"><strong>Quantity:</strong> ${result.quant || "-"}</td>
                 <td style="padding:4px 0;"><strong>Weight:</strong> ${result.weight || "-"} kg</td>
               </tr>
            </table>
          </div>
        `;
      } else {
        retrieveState.innerHTML = `
          <div class="result-card" style="display:block; border-color:#ef4444; background-color:#fef2f2;">
             <strong style="color:#ef4444;">${result.message || "Product not found"}</strong>
          </div>
        `;
      }
    } catch (err) {
      console.error("Retrieval error:", err);
      document.getElementById("retrieveState").innerHTML = `
          <div class="result-card" style="display:block; border-color:#ef4444; background-color:#fef2f2;">
             <strong style="color:#ef4444;">Network error while querying layout</strong>
          </div>
        `;
    }
  });
}
