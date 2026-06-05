const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendRecoveryEmail(to, link) {
  await transporter.sendMail({
    from: `"EatGo" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Recuperação de senha - EatGo",
    html: `
      <div style="
        font-family:Poppins,Arial,sans-serif;
        max-width:600px;
        margin:auto;
        padding:20px;
      ">
        <h2 style="color:#f06000;">
          Recuperação de senha
        </h2>

        <p>
          Você solicitou a recuperação da senha da área de gestão.
        </p>

        <p>
          Clique no botão abaixo para redefinir sua senha:
        </p>

        <a href="${link}"
           style="
             display:inline-block;
             padding:12px 20px;
             background:#f06000;
             color:#ffffff;
             text-decoration:none;
             border-radius:8px;
             margin-top:10px;
             font-weight:600;
           ">
           Redefinir senha
        </a>

        <p style="margin-top:20px;">
          Este link expira em 1 hora.
        </p>

        <p style="color:#666;font-size:14px;">
          Se você não solicitou esta alteração, ignore este email.
        </p>
      </div>
    `
  });
}

module.exports = {
  sendRecoveryEmail
};