## 🏢 Warehouse setup

| Property                   | Value                                 |
| -------------------------- | ------------------------------------- |
| Warehouse name             | MainWarehouse                         |
| Dimensions (L × W × H)     | 40 × 40 × 40                          |
| Usable volume              | 40 × 40 × 40 = 64,000 cubic units     |

---

## 🗄 Racks (5 racks)

Each rack:

•⁠  ⁠Length: 10
•⁠  ⁠Width: 10
•⁠  ⁠Height: 10
•⁠  ⁠Volume: 1,000
•⁠  ⁠Bins per rack: ( \text{floor}(rackVolume / binVolume) = 1,000 / 1,000 = 1 )

So total:

| # of Racks                  | 5                       |
| --------------------------- | ----------------------  |
| Racks total volume          | 5 × 1,000 = 5,000       |
| Racks fit inside warehouse? | ✅ Yes (5,000 < 64,000) |

---

## 📦 Bins (1 bin per rack = 5 bins total)

Each bin:

•⁠  ⁠Length: 10
•⁠  ⁠Width: 10
•⁠  ⁠Height: 10
•⁠  ⁠Volume (capacity) = 10 × 10 × 10 = 1,000

| Bin ID | Rack ID | Capacity | Current Load | Available |
| -----: | ------: | -------: | -----------: | --------: |
|      1 |       1 |     1000 |            0 |      1000 |
|      2 |       2 |     1000 |            0 |      1000 |
|      3 |       3 |     1000 |            0 |      1000 |
|      4 |       4 |     1000 |            0 |      1000 |
|      5 |       5 |     1000 |            0 |      1000 |

Total warehouse capacity = 5 × 1000 = 5000 units.

---

## 🎯 Products to insert (request body)

| Name | Quantity | Size | Priority | Weight |
| ---: | -------: | ---: | -------: | -----: |
|    A |        5 |  200 |     High |     10 |
|    B |        8 |  100 |   Medium |      8 |
|    C |        3 |  250 |      Low |      5 |
|    D |        6 |  300 |     High |      7 |



---

## 🧮 Step 1: Total capacity

From bins table →
totalCapacity = (1000 + 1000 + 1000 + 1000 + 1000) = 5000

---

## 🧠 Step 2: Knapsack input

Compute each product’s weight (volume) and value:

| Product | Size | Qty | Weight (size×quant) | Value (priority) |
| ------- | ---- | --- | ------------------- | ---------------- |
| A       | 200  | 5   | 1000                | 2                |
| B       | 100  | 8   | 800                 | 1                |
| C       | 250  | 3   | 750                 | 0                |
| D       | 300  | 6   | 1800                | 2                |

Knapsack goal:
Maximize total value ≤ 5000 total weight.

---

## 🧩 Step 3: Knapsack selection

It will test combinations:

| Combo         | Total Volume             | Total Value | Fits (≤5000)? |
| ------------- | ------------------------ | ----------- | ------------- |
| A + B + D     | 1000 + 800 + 1800 = 3600 | 5           | ✅ Good        |
| A + D         | 2800                     | 4           | ✅             |
| A + B + C     | 2550                     | 3           | ✅             |
| A + B + C + D | 4350                     | 5           | ✅✅ (Best fit) |
| B + D         | 2600                     | 3           | ✅             |

✅ Best total value = 5, total volume = 4350 ≤ 5000
So selectedProducts = [A, B, C, D]
(knapsack found enough space for all, because total 4350 < 5000)

No remaining products.

---

## 🏗 Step 4: Bin placement

Code now distributes these into bins one by one.

### Product A (size=200, qty=5 → total 1000)

•⁠  ⁠Bin 1 (1000 free): fits exactly.
•⁠  ⁠Insert: (A, 200, 10, 5, priority=2, bin_id=1, rack_id=1)
•⁠  ⁠Update Bin 1 → current_load = 1000 (full)

### Product B (size=100, qty=8 → total 800)

•⁠  ⁠Bin 2 (1000 free): fits.
•⁠  ⁠Insert: (B, 100, 8, 8, priority=1, bin_id=2, rack_id=2)
•⁠  ⁠Update Bin 2 → current_load = 800

### Product C (size=250, qty=3 → total 750)

•⁠  ⁠Bin 3 (1000 free): fits.
•⁠  ⁠Insert: (C, 250, 5, 3, priority=0, bin_id=3, rack_id=3)
•⁠  ⁠Update Bin 3 → current_load = 750

### Product D (size=300, qty=6 → total 1800)

•⁠  ⁠Bin 4 (1000 free): fits 3 units (300×3=900)
•⁠  ⁠Insert: (D, 300, 7, 3, priority=2, bin_id=4, rack_id=4)
•⁠  ⁠Update Bin 4 → current_load = 900
•⁠  ⁠Remaining 3 units (3×300=900)
•⁠  ⁠Bin 5 (1000 free): fits rest.
•⁠  ⁠Insert: (D, 300, 7, 3, priority=2, bin_id=5, rack_id=5)
•⁠  ⁠Update Bin 5 → current_load = 900

---

## 🧾 Step 5: Final database state

### bins

| bin_id | rack_id | capacity | current_load | available |
| -----: | ------: | -------: | -----------: | --------: |
|      1 |       1 |     1000 |         1000 |         0 |
|      2 |       2 |     1000 |          800 |       200 |
|      3 |       3 |     1000 |          750 |       250 |
|      4 |       4 |     1000 |          900 |       100 |
|      5 |       5 |     1000 |          900 |       100 |

### products

| name | size | weight | quantity | priority | warehouse     | company_name | bin_id | rack_id |
| ---- | ---- | ------ | -------- | -------- | ------------- | ------------ | ------ | ------- |
| A    | 200  | 10     | 5        | 2        | MainWarehouse | XYZ          | 1      | 1       |
| B    | 100  | 8      | 8        | 1        | MainWarehouse | XYZ          | 2      | 2       |
| C    | 250  | 5      | 3        | 0        | MainWarehouse | XYZ          | 3      | 3       |
| D    | 300  | 7      | 3        | 2        | MainWarehouse | XYZ          | 4      | 4       |
| D    | 300  | 7      | 3        | 2        | MainWarehouse | XYZ          | 5      | 5       |
