const mongoose = require('mongoose');
const Schema = mongoose.Schema;

function generateSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

const institutionSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    description: {
        type: String,
        trim: true,
        default: ''
    },

    logoUrl: {
        type: String,
        trim: true,
        default: ''
    },

    contactEmail: {
        type: String,
        trim: true,
        lowercase: true
    },

    phone: {
        type: String,
        trim: true
    },

    city: {
        type: String,
        trim: true,
        default: ''
    },

    country: {
        type: String,
        trim: true,
        default: 'Burkina Faso'
    },

    isActive: {
        type: Boolean,
        default: true
    },

    // Branding — up to 3 brand colors
    primaryColor: {
        type: String,
        trim: true,
        default: '#0e7490'
    },
    secondaryColor: {
        type: String,
        trim: true,
        default: ''
    },
    accentColor: {
        type: String,
        trim: true,
        default: ''
    },

    // Social media & web presence
    socialMedia: {
        website:   { type: String, trim: true, default: '' },
        facebook:  { type: String, trim: true, default: '' },
        instagram: { type: String, trim: true, default: '' },
        twitter:   { type: String, trim: true, default: '' },
        linkedin:  { type: String, trim: true, default: '' },
        youtube:   { type: String, trim: true, default: '' },
        whatsapp:  { type: String, trim: true, default: '' }
    },

    // AfrohK admin who created this institution
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Users with institution-admin role for this institution
    admins: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],

}, {
    timestamps: true
});

// Auto-generate slug from name if not provided
institutionSchema.pre('validate', function (next) {
    if (!this.slug && this.name) {
        this.slug = generateSlug(this.name);
    }
    next();
});

institutionSchema.statics.generateSlug = generateSlug;

const Institution = mongoose.model('Institution', institutionSchema);

module.exports = Institution;
