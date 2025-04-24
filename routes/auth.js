const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { sql, poolPromise } = require("../db"); // poolPromise kullanıyoruz
const moment = require("moment");
const momentZ = require("moment-timezone");

// Kullanıcı girişi
router.post("/user-login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await poolPromise; // Bağlantı havuzunu alıyoruz
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM users WHERE email = @email");

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Şifre hatalı" });

    // res.json({ message: 'Kullanıcı girişi başarılı', user });
    // user-login sonrası yönlendirme
    res.redirect(`/auth/user/dashboard?id=${user.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Veritabanı hatası" });
  }
});

// Doktor girişi
router.post("/doctor-login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await poolPromise; // Bağlantı havuzunu alıyoruz
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM doctors WHERE email = @email");

    const doctor = result.recordset[0];
    if (!doctor) return res.status(404).json({ message: "Doktor bulunamadı" });

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) return res.status(401).json({ message: "Şifre hatalı" });

    // res.json({ message: "Doktor girişi başarılı", doctor });
    // doctor-login sonrası yönlendirme
    res.redirect(`/auth/doctor/dashboard?id=${doctor.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Veritabanı hatası" });
  }
});

// Kullanıcı paneli
router.get("/user/dashboard", async (req, res) => {
  try {
    const userId = parseInt(req.query.id, 10);

    const pool = await poolPromise;
    const result = await pool.request().input("userId", sql.Int, userId).query(`
            SELECT a.*, d.name AS doctor_name
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.user_id = @userId
        `);

    // Tarihleri formatla (Örneğin: 'YYYY-MM-DD HH:mm')
    result.recordset.forEach((appointment) => {
      appointment.datetime = moment(appointment.datetime).format(
        "DD-MM-YYY HH:mm"
      );

      // Durumları Türkçe'ye çevir
      switch (appointment.status) {
        case "pending":
          appointment.status = "Beklemede";
          break;
        case "approved":
          appointment.status = "Onaylı";
          break;
        case "cancelled":
          appointment.status = "İptal Edildi";
          break;
        default:
          appointment.status = "Bilinmiyor"; // Eğer durum farklı bir değer alırsa
          break;
      }
    });

    const userResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`SELECT name FROM users WHERE id = @userId`);
    const user = userResult.recordset[0];

    res.render("userDashboard", {
      appointments: result.recordset,
      userId,
      userName: user.name,
    });
  } catch (err) {
    console.error("Hasta paneli hatası:", err);
    res.status(500).send("bir hata oluştu");
  }
});

// Kullanıcı paneli (geçmiş randevular)
router.get("/user/old_appointments/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const pool = await poolPromise;

    // Şu anki UTC zamanı al
    const currentUtcDate = moment.utc().format("YYYY-MM-DD HH:mm:ss");

    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("currentDate", sql.NVarChar, currentUtcDate).query(`
          SELECT a.*, d.name AS doctor_name
          FROM appointments a
          JOIN doctors d ON a.doctor_id = d.id
          WHERE a.user_id = @userId
          AND a.datetime < @currentDate
          ORDER BY a.datetime DESC
        `);

    // Türkiye saatine göre formatla ve durumları çevir
    result.recordset.forEach((appointment) => {
      appointment.datetime = moment
        .utc(appointment.datetime)
        .tz("Asia/Istanbul")
        .format("DD-MM-YYYY HH:mm");

      switch (appointment.status) {
        case "pending":
          appointment.status = "Beklemede";
          break;
        case "approved":
          appointment.status = "Onaylı";
          break;
        case "cancelled":
          appointment.status = "İptal Edildi";
          break;
        default:
          appointment.status = "Bilinmiyor";
          break;
      }
    });

    const userResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`SELECT name FROM users WHERE id = @userId`);
    const user = userResult.recordset[0];

    res.render("userOldAppointments", {
      appointments: result.recordset,
      userId,
      userName: user.name,
    });
  } catch (err) {
    console.error("Hasta paneli hatası:", err);
    res.status(500).send("Bir hata oluştu.");
  }
});

// Doktor paneli
router.get("/doctor/dashboard", async (req, res) => {
  try {
    const doctorId = parseInt(req.query.id, 10); // id'yi int'e çeviriyoruz
    // if (isNaN(doctorId)) {
    //   return res.status(400).send("Geçersiz doktor ID");
    // }

    const pool = await poolPromise;

    const result = await pool.request().input("doctorId", sql.Int, doctorId)
      .query(`
            SELECT a.*, u.name AS user_name
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            WHERE a.doctor_id = @doctorId
            ORDER BY a.datetime DESC
          `);

    result.recordset.forEach((appointment) => {
      appointment.datetime = moment(appointment.datetime).format(
        "DD-MM-YYY HH:mm"
      );
    });

    const doctorResult = await pool
      .request()
      .input("doctorId", sql.Int, doctorId)
      .query(`SELECT name FROM doctors WHERE id = @doctorId`);
    const doctor = doctorResult.recordset[0];

    const appointments = result.recordset;

    res.render("doctorDashboard", {
      appointments,
      doctorId, // eğer panelde tekrar kullanacaksan
      doctorName: doctor.name,
    });
  } catch (err) {
    console.error("Doktor paneli hatası:", err);
    res.status(500).send("Bir hata oluştu.");
  }
});

// Randevu oluşturma sayfasına saat dilimini gönderme
router.get("/user/appointment/create/:id", async (req, res) => {
  const userId = req.params.id; // Kullanıcı ID'si URL parametresinden alınacak

  const pool = await poolPromise;
  const doctorsResult = await pool.request().query("SELECT * FROM doctors");

  // Min ve max tarih aralığı
  let minDatetime = moment().add(1, "hour").format("YYYY-MM-DDTHH:mm"); // 1 saat sonrası

  // Max tarih, 2 hafta sonrası
  let maxDatetime = moment().add(2, "weeks").format("YYYY-MM-DDTHH:mm");

  res.render("createAppointment", {
    userId,
    doctors: doctorsResult.recordset,
    minDatetime,
    maxDatetime,
  });
});

// Randevu oluşturma - Hasta için

router.post("/user/appointment/create/:id", async (req, res) => {
  try {
    const { datetime, doctor_id, notes } = req.body;
    const userId = req.params.id; // Kullanıcı ID'si URL parametresinden alınacak

    const userTimezoneDatetime = momentZ.tz(datetime, "Asia/Istanbul");

    // Hafta sonları (Cumartesi ve Pazar) randevu alınamaz
    const dayOfWeek = userTimezoneDatetime.day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // 0: Pazar, 6: Cumartesi
      return res.status(400).send("Hafta sonları randevu alınamaz.");
    }

    // 08:00 ile 17:00 arasında randevu almak zorunlu
    const hour = userTimezoneDatetime.hour();
    if (hour < 8 || hour >= 17) {
      return res
        .status(400)
        .send("Randevu sadece 08:00 ile 17:00 saatleri arasında yapılabilir.");
    }

    // 12:00 ile 13:00 arasında randevu alınamaz
    if (
      hour === 12 &&
      userTimezoneDatetime.minute() >= 0 &&
      userTimezoneDatetime.minute() < 60
    ) {
      return res
        .status(400)
        .send(
          "12:00 ile 13:00 arasında öğle arası olduğu için randevu alınamaz."
        );
    }

    // Eğer dakika 00 değilse, hata mesajı ver
    if (userTimezoneDatetime.minute() !== 0) {
      return res
        .status(400)
        .send(
          "Randevu sadece saat başına yapılabilir. Lütfen saat başı bir zaman seçin."
        );
    }

    // Veriyi olduğu gibi UTC'ye dönüştürmeden kaydetme
    const formattedDatetime = userTimezoneDatetime.format(
      "YYYY-MM-DD HH:mm:ss"
    );

    const pool = await poolPromise;

    // Seçilen doktor ve saat için daha önce alınmış randevu var mı diye kontrol et
    const existingAppointment = await pool
      .request()
      .input("datetime", sql.DateTime, formattedDatetime)
      .input("doctor_id", sql.Int, doctor_id).query(`
              SELECT * FROM appointments
              WHERE doctor_id = @doctor_id
              AND datetime = @datetime
            `);

    if (existingAppointment.recordset.length > 0) {
      return res
        .status(400)
        .send("Seçilen saatte başka bir hasta tarafından randevu alınmış.");
    }

    // Randevu oluştur (Veriyi olduğu gibi kaydet)
    await pool
      .request()
      .input("datetime", sql.DateTime, formattedDatetime)
      .input("doctor_id", sql.Int, doctor_id)
      .input("user_id", sql.Int, userId)
      .input("notes", sql.VarChar, notes).query(`
              INSERT INTO appointments (datetime, doctor_id, user_id, notes, status)
              VALUES (@datetime, @doctor_id, @user_id, @notes, 'pending')
            `);

    res.send("Randevunuz başarıyla oluşturuldu.");
  } catch (err) {
    console.error("Randevu oluşturulurken hata:", err);
    res.status(500).send("Bir hata oluştu");
  }
});


// Doktor randevu onaylama
router.post("/doctor/appointment/approve/:id", async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const doctor = req.body.doctorId; // Doktor ID'si formdan alınacak

    // Veritabanında randevu durumu güncelle
    const pool = await poolPromise;
    await pool.request().input("appointmentId", sql.Int, appointmentId).query(`
          UPDATE appointments
          SET status = 'approved'
          WHERE id = @appointmentId
        `);

    // Randevu onaylandıktan sonra doktorun randevu listesine yönlendir
    //   res.redirect(`/auth/doctor/dashboard?id=${doctor}`); // veya uygun bir yönlendirme
    const referer = req.get("Referrer") || "/"; // Eğer referer yoksa, ana sayfaya yönlendir
    res.redirect(referer);
  } catch (err) {
    console.error("Randevu onaylanırken hata:", err);
    res.status(500).send("Bir hata oluştu");
  }
});

// Kullanıcı kayıt işlemi
router.post("/register/user", async (req, res) => {
  const { name, email, password } = req.body;

  // Şifreyi hash'le
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const pool = await poolPromise; // Bağlantı havuzunu alıyoruz
    const result = await pool
      .request()
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, hashedPassword)
      .query(
        "INSERT INTO users (name, email, password) VALUES (@name, @email, @password)"
      );

    res.redirect("/login/user"); // Kullanıcı giriş sayfasına yönlendir
  } catch (err) {
    console.error("Kullanıcı kaydederken hata:", err);
    res.status(500).json({ message: "Kullanıcı kaydedilemedi." });
  }
});

// Doktor kayıt işlemi
router.post("/register/doctor", async (req, res) => {
  const { name, email, password, expert } = req.body;

  // Şifreyi hash'le
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const pool = await poolPromise; // Bağlantı havuzunu alıyoruz
    const result = await pool
      .request()
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, hashedPassword)
      .input("expert", sql.VarChar, expert)
      .query(
        "INSERT INTO doctors (name, email, password, expert) VALUES (@name, @email, @password, @expert)"
      );

    res.redirect("/login/doctor"); // Doktor giriş sayfasına yönlendir
  } catch (err) {
    console.error("Doktor kaydederken hata:", err);
    res.status(500).json({ message: "Doktor kaydedilemedi." });
  }
});

// Logout işlemi
router.get("/logout", (req, res) => {
  res.redirect("/"); // Ana sayfaya yönlendir
});

module.exports = router;
