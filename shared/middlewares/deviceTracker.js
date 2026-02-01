const useragent = require('express-useragent');
const crypto = require('crypto');

// Middleware pour parser le User-Agent
const parseUserAgent = useragent.express();

// Fonction pour générer un ID unique d'appareil
function generateDeviceId(req) {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  
  // Créer un hash unique basé sur les caractéristiques de l'appareil
  const deviceString = `${userAgent}-${ip}-${acceptLanguage}`;
  return crypto.createHash('sha256').update(deviceString).digest('hex').substring(0, 16);
}

// Middleware pour détecter et enregistrer l'appareil
async function trackDevice(req, res, next) {
  if (!req.user) {
    return next();
  }

  try {
    const User = require('../models/user');
    const deviceId = generateDeviceId(req);
    
    // Vérifier si l'appareil existe déjà
    const user = await User.findById(req.user._id);
    const existingDevice = user.devices.find(d => d.deviceId === deviceId);
    
    if (existingDevice) {
      // Mettre à jour la dernière connexion
      existingDevice.lastLogin = new Date();
      existingDevice.isActive = true;
      existingDevice.ipAddress = req.ip || req.connection.remoteAddress || '';
      await user.save();
    } else {
      // Nouvel appareil détecté
      const deviceInfo = {
        deviceId: deviceId,
        deviceType: req.useragent.isMobile ? 'mobile' : 
                   req.useragent.isTablet ? 'tablet' : 'desktop',
        browser: req.useragent.browser || 'Unknown',
        os: req.useragent.os || 'Unknown',
        platform: req.useragent.platform || 'Unknown',
        userAgent: req.useragent.source || req.headers['user-agent'] || '',
        ipAddress: req.ip || req.connection.remoteAddress || '',
        lastLogin: new Date(),
        firstSeen: new Date(),
        isActive: true
      };

      // Vérifier la limite d'appareils
      const activeDevices = user.devices.filter(d => d.isActive).length;
      
      if (activeDevices >= user.maxDevices) {
        // Bloquer la connexion ou demander de retirer un appareil
        req.flash('error', `Limite d'appareils atteinte (${user.maxDevices}). Veuillez vous déconnecter d'un autre appareil ou contacter l'administrateur.`);
        req.logout((err) => {
          if (err) return next(err);
          return res.redirect('/login?deviceLimit=true');
        });
        return;
      }

      // Ajouter le nouvel appareil
      user.devices.push(deviceInfo);
      await user.save();
      
      // Optionnel: Envoyer un email d'alerte pour nouveau appareil
      // await sendNewDeviceAlert(user, deviceInfo);
    }
    
    next();
  } catch (error) {
    console.error('Error tracking device:', error);
    next(); // Continuer même en cas d'erreur
  }
}

module.exports = {
  parseUserAgent,
  trackDevice,
  generateDeviceId
};
