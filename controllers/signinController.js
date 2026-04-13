const db = require('../db.js');
const bcrypt = require('bcryptjs');

const get = (req,res)=>{
  if (req.session && req.session.userId) {
      return res.redirect('/dashboard');
  }
  const incorrectPass = req.session.incorrectPass || false;
  const userNotFound = req.session.userNotFound || false;
  req.session.incorrectPass = null;
  req.session.userNotFound = null;
  res.render("login", { incorrectPass,userNotFound });
}

const post = async (req,res)=>{
    const { email, password } = req.body;
    
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          email,
        ]);
    
        const user = result.rows[0];
        if (!user) {
          // console.log("User not Found");
          req.session.userNotFound = true;
          return res.redirect("/login");
        }
    
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          // console.log("Wrong Password");
          req.session.incorrectPass = true;
          return res.redirect("/login");
        }
    
        req.session.name = user.name;
        req.session.email = user.email;
        req.session.userId = user.user_id;
        req.session.companyName = user.company_name;   // keep old one
        req.session.company_name = user.company_name;  // NEW REQUIRED ONE
    
        res.redirect("/dashboard");
      } catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
      }
}

module.exports = {get,post};