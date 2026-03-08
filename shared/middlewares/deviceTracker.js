const UAParser = require('ua-parser-js');
const crypto = require('crypto');

// Middleware pour parser le User-Agent
const parseUserAgent = (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  req.useragent = parser.getResult();
  next();
};

const { v4: uuidv4 } = require('uuid');

// Fonction pour récupérer ou générer un ID unique d'appareil via les cookies
function getOrGenerateDeviceId(req, res) {
  // 1. Check if the browser already has a device cookie
  let deviceId = req.cookies?.device_id;

  if (!deviceId) {
    // 2. If no cookie exists, generate a new secure UUID
    deviceId = uuidv4();

    // 3. Set a long-lived HTTP-only cookie on the user's browser (e.g., 10 years)
    res.cookie('device_id', deviceId, {
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
      httpOnly: true, // Prevents XSS attacks from reading the cookie
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
      sameSite: 'lax'
    });
  }

  return deviceId;
}

// Middleware pour détecter et enregistrer l'appareil
async function trackDevice(req, res, next) {
  if (!req.user) {
    return next();
  }

  try {
    const User = require('../models/user');
    const deviceId = getOrGenerateDeviceId(req, res);

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
      // Extraire les infos avec ua-parser-js localement car req.useragent est dominé par express-useragent
      const parser = new UAParser(req.headers['user-agent'] || '');
      const uaResult = parser.getResult();

      const isMobile = uaResult.device.type === 'mobile';
      const isTablet = uaResult.device.type === 'tablet';
      // Si ce n'est ni mobile ni tablette, on assume desktop
      const isDesktop = !isMobile && !isTablet && !uaResult.device.type;
      const deviceModel = uaResult.device.model || 'Unknown';
      const deviceVendor = uaResult.device.vendor || 'Unknown';
      const browserInfo = uaResult.browser.name
        ? `${uaResult.browser.name} ${uaResult.browser.version || ''}`.trim()
        : 'Unknown';

      const osInfo = uaResult.os.name
        ? `${uaResult.os.name} ${uaResult.os.version || ''}`.trim()
        : 'Unknown';

      const deviceInfo = {
        deviceId: deviceId,
        deviceType: isMobile ? 'mobile' :
          isTablet ? 'tablet' : 'desktop',
        deviceModel: `${deviceVendor} ${deviceModel}`.trim(),
        browser: browserInfo,
        os: osInfo,
        platform: uaResult.os.name || 'Unknown',
        userAgent: uaResult.ua || req.headers['user-agent'] || '',
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
  getOrGenerateDeviceId
};
