# 📦 StockMate – Warehouse Optimization System

An intelligent, web-based system designed to optimize warehouse storage using the **0/1 Knapsack Algorithm** and **hashing techniques** for efficient product placement and retrieval. Built with **Node.js, Express, PostgreSQL, and EJS**, this platform ensures maximum space utilization and ultra-fast inventory access.

---

## 🚀 Features

* ✅ **User Authentication**

  * Secure sign-up and login with hashed passwords using `bcrypt`
  * Session management for authenticated routes

* 🏗️ **Warehouse Setup**

  * Create warehouses with custom dimensions
  * Automatically calculates usable space and manages racks/bins

* 📊 **Smart Inventory Management**

  * Add products in bulk with size, quantity, and priority
  * Uses **0/1 Knapsack Algorithm** for optimal bin allocation

* 🔍 **Fast Product Retrieval**

  * Locate products instantly using **hashing** (O(1) search time)
  * View rack/bin details for any product

* 💾 **PostgreSQL Integration**

  * Stores user data, warehouse structure, bins, racks, and product info

* 🌐 **Dynamic Frontend**

  * Built using **EJS templates** for interactive and responsive views

---

## 🛠️ Tech Stack

| Technology | Purpose                      |
| ---------- | ---------------------------- |
| Node.js    | Backend runtime              |
| Express.js | Web server framework         |
| PostgreSQL | Relational database          |
| EJS        | Server-side templating       |
| JavaScript | Frontend & backend scripting |
| CSS / HTML | UI styling and structure     |

---

## 🧠 Algorithms Used

* **0/1 Knapsack Algorithm**
  Efficiently selects which products to place in bins for optimal space utilization while respecting capacity constraints.

* **Hashing**
  Enables constant time (`O(1)`) lookup for ultra-fast product location and retrieval.

---

## 🖥️ Frontend Preview

To get a visual walkthrough of the application:

👉 **Check out the `Screenshots/` folder** to see the working frontend, key workflows, dashboard views, warehouse layouts, and product allocation in action.

---

## 📌 Installation & Setup

Follow these steps to set up and run the project locally:

```bash
# Clone the repository
git clone https://github.com/yourusername/warehouse-optimization.git

# Navigate to the project directory
cd warehouse-optimization

# Install dependencies
npm install
```

### 🔐 Environment Variable Setup (.env)

Create a `.env` file in the root directory and add the following configuration:

```env
PORT=3000
DATABASE_URL=postgresql://<USERNAME>:<PASSWORD>@<HOST>/<DB_NAME>?sslmode=require
sslmode=require
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
```

> ⚠️ **Important:** Never commit your real `.env` file to GitHub. Always use environment variables for sensitive credentials.

### ▶️ Run the Application

```bash
node app.js
```

The application will start on:

```
http://localhost:3000
```

---

## 📈 Future Enhancements

* 📱 Mobile-first responsive UI
* 📊 Advanced analytics dashboard
* 🤖 AI-based demand prediction
* 🏷️ Barcode / QR-based product scanning
* 🔐 Role-based access control (Admin, Manager, Staff)

---

## 👨‍💻 Author

Developed by **Sarthak Singh**
*AI x Startup Enthusiast*

---
