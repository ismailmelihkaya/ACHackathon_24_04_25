const express = require('express');
const exphbs = require('express-handlebars');
const handlebars = require('handlebars');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();


// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// view engine ayarları
// 'eq' helper'ını tanımlıyoruz
handlebars.registerHelper('eq', function (a, b, options) {
    if (a === b) {
      return options.fn(this);  // Eşitse, blok içeriğini döndür
    } else {
      return options.inverse(this);  // Eşit değilse, ters blok içeriğini döndür
    }
  });
app.engine('handlebars', exphbs.engine({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// ROUTES

app.get('/', renderHomePage = (req, res) => {
    res.render('home');
});  

const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// GİRİŞ ROUTES
app.get('/login/user', (req, res) => {
    res.render('userLogin');
});

app.get('/login/doctor', (req, res) => {
    res.render('doctorLogin');
});

// KAYIT ROUTES
app.get('/register/user', (req, res) => {
    res.render('userRegister');
});

app.get('/register/doctor', (req, res) => {
    res.render('doctorRegister');
});

app.get('/geri-gitmek', (req, res) => {
    const referer = req.get('Referrer') || '/'; // Eğer referer yoksa, ana sayfaya yönlendir
    res.redirect(referer);
});

// Sunucuyu başlat
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:3000 adresinde çalışıyor`);
});