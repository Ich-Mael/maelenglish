// MaelEnglish storefront pages (ex « English Boost »)
const { PROGRAMS, whatsappLink } = require("../catalog");

const OG_IMAGE = "/assets/img/Maelenglish/maelenglish-og.jpg";

// Single storefront page: landing + programme catalogue (/maelenglish/cours redirects here)
module.exports.renderMaelEnglish = (req, res) => {
    res.render("programs/language-learning/maelenglish/home", {
        programs: PROGRAMS,
        whatsappLink,
        title: "MaelEnglish — Speak the Language of Your Profession",
        metaDescription: "MaelEnglish : l'anglais général (Essentials, 8 semaines par niveau) et l'anglais professionnel en 12 semaines pour l'aviation, le business, la santé, la tech, la finance, le droit, le génie civil, la logistique et le fitness. Coaching individuel et challenges, avec des coachs qui corrigent chaque étape.",
        ogImage: OG_IMAGE,
    });
};

module.exports.renderPecp = (req, res) => {
    res.render("programs/language-learning/pecp/home", {
        title: "MaelEnglish Coaching — coaching d'anglais professionnel individuel",
        metaDescription: "MaelEnglish Coaching : un coach dédié et un programme d'anglais taillé pour votre poste, votre secteur et vos échéances (entretien, prise de poste, présentation, négociation).",
        ogImage: OG_IMAGE,
    });
};
