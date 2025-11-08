// server.js - Backend Node.js pour JOBI
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Import Brevo (anciennement SendinBlue)
// const SibApiV3Sdk = require("sib-api-v3-sdk");

const app = express();
// ✅ Configuration CORS - pour autoriser ton frontend à accéder à l'API
app.use(
  cors({
    origin: "https://jobi-sepia.vercel.app", // autorise tout le monde (à sécuriser plus tard)
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Pour traiter les requêtes JSON
// app.use(express.json());

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration Brevo
// const defaultClient = SibApiV3Sdk.ApiClient.instance;
// const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Schéma MongoDB pour les inscriptions JOBI
const inscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["travailleur", "employeur", "les-deux"],
    },
    quartier: {
      type: String,
      trim: true,
    },
    dateInscription: {
      type: Date,
      default: Date.now,
    },
    emailEnvoye: {
      type: Boolean,
      default: false,
    },
    statut: {
      type: String,
      default: "en_attente",
      enum: ["en_attente", "notifie", "actif"],
    },
  },
  { timestamps: true } // ✅ ajoute cette ligne
);

const Inscription = mongoose.model("Inscription", inscriptionSchema);

// Connexion à MongoDB Atlas
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connecté à MongoDB Atlas"))
  .catch((err) => console.error("❌ Erreur MongoDB:", err));

// Fonction pour envoyer l'email de bienvenue
// Fonction pour envoyer l'email de bienvenue via le template Brevo
// --- Configuration de Brevo (Sendinblue) ---
const SibApiV3Sdk = require("sib-api-v3-sdk");
require("dotenv").config();

// Création d'une instance de l'API Brevo
// const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Configuration de la clé API (authentification)
let apiKey =
  apiInstance.authentications["apiKey"] ||
  apiInstance.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

// --- Fonction d'envoi d'email de bienvenue ---
async function envoyerEmailBienvenue(inscription) {
  // Texte adapté selon le type de compte
  const typeTexte = {
    travailleur: "chercheur de travail",
    employeur: "employeur",
    "les-deux": "chercheur de travail ET employeur",
  };

  // Corps de l'email basé sur un template Brevo
  const sendSmtpEmail = {
    sender: {
      email: process.env.SENDER_EMAIL, // ✅ adresse d'expéditeur vérifiée sur Brevo
      name: "JOBI - Plateforme de connexion professionnelle",
    },
    to: [
      {
        email: inscription.email,
        name: inscription.name,
      },
    ],
    templateId: 4, // ⚠️ remplace 4 par l’ID exact de ton template Brevo
    params: {
      NAME: inscription.name,
      PHONE: inscription.phone,
      EMAIL: inscription.email || "Non renseigné",
      TYPE: typeTexte[inscription.type],
      QUARTIER: inscription.quartier || "Ouagadougou",
    },
  };

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email envoyé via Brevo à :", inscription.name);
    return true;
  } catch (error) {
    console.error("❌ Erreur envoi email Brevo :", error);
    return false;
  }
}

module.exports = { envoyerEmailBienvenue };

// Route principale
app.get("/", (req, res) => {
  res.json({
    message: "🇧🇫 API JOBI - Prêt pour la révolution !",
    version: "1.0.0",
    status: "active",
  });
});

// Route pour les inscriptions
app.post("/api/inscription", async (req, res) => {
  try {
    const { name, phone, email, type, quartier } = req.body;

    // Validation des données obligatoires
    if (!name || !phone || !type) {
      return res.status(400).json({
        success: false,
        message: "Nom, téléphone et type sont obligatoires",
      });
    }

    // Vérifier si l'utilisateur existe déjà (par téléphone)
    const existant = await Inscription.findOne({ phone: phone });
    if (existant) {
      return res.status(409).json({
        success: false,
        message: "Ce numéro de téléphone est déjà inscrit !",
        data: {
          name: existant.name,
          dateInscription: existant.dateInscription,
        },
      });
    }

    // Créer la nouvelle inscription
    const nouvelleInscription = new Inscription({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      type,
      quartier: quartier ? quartier.trim() : null,
    });

    // Sauvegarder en base
    await nouvelleInscription.save();
    console.log("✅ Nouvelle inscription sauvegardée:", name);

    // Envoyer l'email de bienvenue (seulement si email fourni)
    let emailEnvoye = false;
    if (email && email.trim()) {
      emailEnvoye = await envoyerEmailBienvenue(nouvelleInscription);

      // Mettre à jour le statut d'email
      nouvelleInscription.emailEnvoye = emailEnvoye;
      await nouvelleInscription.save();
    }

    // Réponse de succès
    res.status(201).json({
      success: true,
      message: `🎉 Inscription réussie ! Bienvenue dans JOBI, ${name} !`,
      data: {
        id: nouvelleInscription._id,
        name: nouvelleInscription.name,
        type: nouvelleInscription.type,
        quartier: nouvelleInscription.quartier,
        emailEnvoye: emailEnvoye,
        dateInscription: nouvelleInscription.dateInscription,
      },
    });
  } catch (error) {
    console.error("❌ Erreur inscription:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur. Réessayez plus tard.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Route pour obtenir les statistiques
app.get("/api/stats", async (req, res) => {
  try {
    const totalInscriptions = await Inscription.countDocuments();
    const parType = await Inscription.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    const parQuartier = await Inscription.aggregate([
      { $group: { _id: "$quartier", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        total: totalInscriptions,
        parType: parType,
        parQuartier: parQuartier.filter((q) => q._id), // Exclure les quartiers null
        derniereInscription: await Inscription.findOne()
          .sort({ dateInscription: -1 })
          .select("name dateInscription"),
      },
    });
  } catch (error) {
    console.error("❌ Erreur stats:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des statistiques",
    });
  }
});

// Route pour envoyer des notifications de lancement
app.post("/api/notify-launch", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message de notification requis",
      });
    }

    // Récupérer toutes les inscriptions avec email
    const inscriptions = await Inscription.find({
      email: { $exists: true, $ne: null },
      statut: "en_attente",
    });

    let emailsEnvoyes = 0;
    const erreurs = [];

    // Envoyer la notification à tous
    for (let inscription of inscriptions) {
      const sendSmtpEmail = {
        to: [
          {
            email: inscription.email,
            name: inscription.name,
          },
        ],
        sender: {
          name: "Équipe JOBI",
          email: process.env.SENDER_EMAIL || "contact@jobi.bf",
        },
        subject: "🚀 JOBI est enfin là ! Télécharge l'app maintenant !",
        htmlContent: `
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px;">
                        <h1 style="text-align: center; color: #FF6B35; font-size: 2.5rem;">🎉 JOBI EST LÀ ! 🎉</h1>
                        <h2>Salut ${inscription.name} !</h2>
                        <p style="font-size: 1.2rem; font-weight: bold; color: #4ECDC4;">LE MOMENT EST ARRIVÉ !</p>
                        <div style="background: linear-gradient(45deg, #4ECDC4, #45B7D1); color: white; padding: 20px; border-radius: 15px; margin: 20px 0;">
                            ${message}
                        </div>
                        <p>Tu étais parmi les premiers à croire en JOBI. Maintenant, il est temps de transformer ton attente en action !</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="#" style="background: linear-gradient(45deg, #FF6B35, #F7931E); color: white; padding: 15px 30px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 1.2rem;">📱 TÉLÉCHARGER JOBI</a>
                        </div>
                        <p><strong>Ton profil JOBI :</strong><br>
                        📍 ${inscription.quartier || "Ouagadougou"}<br>
                        🎯 ${inscription.type}<br>
                        📱 ${inscription.phone}</p>
                        <p style="text-align: center; color: #666; margin-top: 30px;">JOBI - Le Job qui vient à toi 🇧🇫</p>
                    </div>
                </body>
                </html>
                `,
      };

      try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        emailsEnvoyes++;

        // Marquer comme notifié
        inscription.statut = "notifie";
        await inscription.save();
      } catch (error) {
        erreurs.push({
          email: inscription.email,
          erreur: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Notifications envoyées avec succès !`,
      data: {
        totalInscriptions: inscriptions.length,
        emailsEnvoyes,
        erreurs: erreurs.length,
      },
    });
  } catch (error) {
    console.error("❌ Erreur notification lancement:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi des notifications",
    });
  }
});

// Middleware d'authentification admin simple
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // Change ce mot de passe par le tien !
  if (token === "jobi2025") {
    next();
  } else {
    return res.status(401).json({ error: "Non autorisé" });
  }
}

// Route pour servir le dashboard admin
app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/admin-dashboard.html");
});

// Route pour récupérer tous les utilisateurs (protégée)
app.get("/api/admin/users", authenticateAdmin, async (req, res) => {
  try {
    const users = await Inscription.find()
      .sort({ createdAt: -1 }) // Plus récents en premier
      .lean(); // Pour de meilleures performances

    res.json(users);
  } catch (error) {
    console.error("Erreur récupération utilisateurs:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour statistiques détaillées
app.get("/api/admin/stats", authenticateAdmin, async (req, res) => {
  try {
    const total = await Inscription.countDocuments();
    const travailleurs = await Inscription.countDocuments({
      type: { $in: ["travailleur", "les-deux"] },
    });
    const employeurs = await Inscription.countDocuments({
      type: { $in: ["employeur", "les-deux"] },
    });

    // Inscriptions aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Inscription.countDocuments({
      createdAt: { $gte: today },
    });

    // Répartition par quartier
    const quartierStats = await Inscription.aggregate([
      { $match: { quartier: { $ne: null, $ne: "" } } },
      { $group: { _id: "$quartier", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Évolution des inscriptions (7 derniers jours)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const dailyStats = await Inscription.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    res.json({
      total,
      travailleurs,
      employeurs,
      today: todayCount,
      quartierStats,
      dailyStats,
    });
  } catch (error) {
    console.error("Erreur récupération stats:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour envoi d'email groupé
app.post("/api/admin/send-bulk-email", authenticateAdmin, async (req, res) => {
  try {
    const users = await Inscription.find({ email: { $ne: null, $ne: "" } });
    const emailPromises = [];

    for (const user of users) {
      const emailData = {
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: "Équipe Jobi" },
        to: [{ email: user.email, name: user.name }],
        subject: "🚀 Jobi arrive bientôt !",
        htmlContent: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #FF6B35, #F7931E); color: white; border-radius: 15px; overflow: hidden;">
                        <div style="padding: 40px; text-align: center;">
                            <h1 style="font-size: 3em; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🚀 JOBI</h1>
                            <p style="font-size: 1.3em; margin: 20px 0;">Salut ${user.name} ! 👋</p>
                            <div style="background: rgba(255,255,255,0.2); padding: 30px; border-radius: 15px; margin: 30px 0;">
                                <h2 style="margin-bottom: 20px;">🔥 L'app est presque prête ! 🔥</h2>
                                <p style="font-size: 1.1em; line-height: 1.6;">
                                    On finalise les derniers détails de l'application qui va révolutionner 
                                    le monde du travail au Burkina Faso ! Tu seras parmi les premiers à pouvoir l'utiliser ! 💪
                                </p>
                                <p style="font-size: 1.2em; margin: 30px 0;">
                                    ⚡ Encore quelques semaines et c'est parti ! ⚡
                                </p>
                            </div>
                            <p style="margin-top: 40px; font-size: 1.1em;">
                                🇧🇫 La révolution burkinabè du travail commence bientôt ! 🇧🇫
                            </p>
                        </div>
                    </div>
                `,
      };

      emailPromises.push(
        fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": process.env.BREVO_API_KEY,
          },
          body: JSON.stringify(emailData),
        })
      );
    }

    await Promise.all(emailPromises);
    res.json({ success: true, count: users.length });
  } catch (error) {
    console.error("Erreur envoi bulk email:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi" });
  }
});

console.log("📊 Routes admin configurées ! Accès: http://localhost:3000/admin");

// route Supprimer un utilisateur
app.delete("/api/admin/users/:id", authenticateAdmin, async (req, res) => {
  try {
    await Inscription.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error("❌ Erreur serveur:", err);
  res.status(500).json({
    success: false,
    message: "Erreur interne du serveur",
  });
});

// Route 404
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`
🚀 ========================================
   SERVEUR JOBI DÉMARRÉ AVEC SUCCÈS !
========================================
📡 Port: ${PORT}
🌍 Environnement: ${process.env.NODE_ENV || "development"}
🇧🇫 Prêt pour la révolution burkinabè !
========================================
    `);
});

module.exports = app;
