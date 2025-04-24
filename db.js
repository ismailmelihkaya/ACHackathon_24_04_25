// db.js
const sql = require('mssql');
require('dotenv').config();  // dotenv'i kullanarak .env dosyasını yükle

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,  // Azure için true kullanabilirsiniz
        trustServerCertificate: true  // SQL Server lokal ise true kullanın
    }
};

// Bağlantıyı sağlamak için pool oluşturuyoruz
const poolPromise = new sql.ConnectionPool(config).connect();  // Bu doğru kullanım

module.exports = { sql, poolPromise };
