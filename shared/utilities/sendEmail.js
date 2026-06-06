const nodemailer = require("nodemailer");
const path = require("path");
const htmlToText = require("html-to-text");
const ejs = require("ejs");

module.exports = class Emailer {
  constructor(user, url) {
    this.to = user.email;
    this.user = user;
    this.url = url;
    this.from = `AfroHK Team <${process.env.EMAIL_FROM || 'contact@afrohk.com'}>`;
  }

  newTransport() {
    const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
    const port = process.env.EMAIL_PORT || 587;
    const user = process.env.EMAIL_USERNAME;
    const pass = process.env.EMAIL_PASSWORD;

    if (!user || !pass) {
        console.error("❌ ERREUR EMAIL: Les identifiants SMTP (EMAIL_USERNAME ou EMAIL_PASSWORD) ne sont pas définis dans le fichier .env !");
    }

    return nodemailer.createTransport({
      host: host,
      port: port,
      auth: {
        user: user,
        pass: pass
      }
    });

    /*	      
	  if (process.env.NODE_ENV === 'production') {
	    // Sendgrid
	   
	  }
      
	  return nodemailer.createTransport({
	    host: process.env.EMAIL_HOST,
	    port: process.env.EMAIL_PORT,
	    auth: {
	      user: process.env.EMAIL_USERNAME,
	      pass: process.env.EMAIL_PASSWORD
	    }
	  });
	  */
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    let html;

    ejs.renderFile(
      path.join(__dirname, "../../views/emails", `${template}.ejs`), {
        user: this.user,
        url: this.url,
        subject,
      },
      function (err, str) {
        if (err) {
          console.log(err);
        } else {
          html = str;
        }
      }
    );
    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText.convert(html, {
        wordwrap: 130,
      }),
    };
    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendVerifyEmail() {
    await this.send("welcome_mail", "Welcome to the Afrohk Family!");
  }

  async sendPasswordReset(url) {
    this.url = url;
    const template = "passwordReset";
    const subject = "Réinitialisation de mot de passe (Afro House of Knowledge)";
    
    // Use the explicit ejs render logic used in sendActivationEmail to be safe and consistent
    let html;
    const data = {
        user: this.user,
        url: this.url,
        subject
    };
    
    try {
        html = await ejs.renderFile(path.join(__dirname, "../../views/emails", `${template}.ejs`), data);
    } catch (err) {
        console.log(err);
        return;
    }

    const mailOptions = {
        from: this.from,
        to: this.to,
        subject,
        html,
        text: htmlToText.convert(html, { wordwrap: 130 }),
    };

    await this.newTransport().sendMail(mailOptions);
  }

  async sendEnrollmentEmail(courseTitle, startDate, endDate, loginUrl) {
    const template = "enrollment";
    const subject = `Inscription au cours "${courseTitle}" — AfroHK`;

    const data = {
      user: this.user,
      courseTitle,
      startDate: new Date(startDate).toLocaleDateString('fr-FR'),
      endDate: new Date(endDate).toLocaleDateString('fr-FR'),
      loginUrl,
      subject
    };

    let html;
    try {
      html = await ejs.renderFile(path.join(__dirname, "../../views/emails", `${template}.ejs`), data);
    } catch (err) {
      console.error('Enrollment email render error:', err);
      return;
    }

    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText.convert(html, { wordwrap: 130 }),
    };

    await this.newTransport().sendMail(mailOptions);
  }

  async sendActivationEmail(password) {
    // Add password to the local scope for the template
    this.password = password;
    
    // We need to pass the password to the template render context in the send() method
    // But since the send() method only passes this.user, this.url and subject
    // We'll modify the send method slightly or just override it here by calling ejs directly
    // Or simpler: modify the send method to accept extra data, but let's stick to the pattern
    
    // The send method uses:
    /*
      ejs.renderFile(..., {
        user: this.user,
        url: this.url,
        subject,
      }, ...)
    */
    
    // To pass the password, we can attach it to the user object temporarily or modify the send method.
    // Let's modify the send method to accept data.
    // For now, let's just make a specialized call here to avoid changing the main send method signature if it affects other calls.
    
    let html;
    const template = "activation_account";
    const subject = "Activation de votre compte AfroHK";

    const data = {
        user: this.user,
        url: this.url,
        subject,
        password: password
    };

    try {
        html = await ejs.renderFile(path.join(__dirname, "../../views/emails", `${template}.ejs`), data);
    } catch (err) {
        console.log(err);
        return;
    }

    const mailOptions = {
        from: this.from,
        to: this.to,
        subject,
        html,
        text: htmlToText.convert(html, { wordwrap: 130 }),
    };

    await this.newTransport().sendMail(mailOptions);
  }
};

/*
const sgTransport = nodemailer.createTransport({
  service: "SendGrid",
  auth: {
    user: process.env.SG_API_KEY,
    pass: process.env.SG_API_KEY_PASSWORD
  },
});

module.exports.sendResetEmail = async (email, token) => {
   // change first part to your domain
  let url = "http://localhost:8000/user/reset-password?token=" + token;

  await sgTransport.sendMail({
    from: "<afrohouseofknowledge@gmail.com>",
    to: email,
    subject: "RESET YOUR PASSWORD",
    text: `Click on this link to reset your password ${url}`,
    html: `<h3> Click on this link to reset your password : ${url} </h3>`,
  });
};

module.exports.sendVerifyEmail = async (user, token) => {
  // change first part to your domain
  let url;
  if(process.env.NODE_ENV == "production") {
	url = "https://www.afrohk.com/user/verifyemail?token=" + token;
    }else{
	url = "http://localhost:3000/user/verifyemail?token=" + token;
    }
console.log(url, user.username, user.email);
const html = ejs.renderFile(path.join(__dirname, "../views/emails/welcome_mail.ejs"),{
	username: user.username,
	url
});

  await sgTransport.sendMail({
    from: "<afrohouseofknowledge@gmail.com>",
    to: user.email,
    subject: "Activation votre compte",
    text: `Cliquez sur ce lien pour activer votre compte ${url}`,
    html
  });
};
*/