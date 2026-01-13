#!/usr/bin/env node

/**
 * Script pour vider complètement la base de données
 * Usage: node scripts/clear-db.js
 * 
 * ⚠️ ATTENTION: Ce script supprime TOUTES les données de la base de données!
 */

if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const mongoose = require("mongoose");

// Database connection
const dbUrl = process.env.APP_DB || 'mongodb://localhost:27017/afrohk';

async function clearDatabase() {
    try {
        console.log("🔌 Connexion à la base de données...");
        await mongoose.connect(dbUrl);
        console.log("✅ Connecté à la base de données:", dbUrl);
        
        // Get all collection names
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        if (collections.length === 0) {
            console.log("📭 La base de données est déjà vide.");
            await mongoose.connection.close();
            process.exit(0);
        }
        
        console.log(`\n📋 Collections trouvées (${collections.length}):`);
        collections.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.name}`);
        });
        
        // Delete all collections
        console.log("\n🗑️  Suppression de toutes les collections...");
        for (const collection of collections) {
            await mongoose.connection.db.dropCollection(collection.name);
            console.log(`   ✅ Collection "${collection.name}" supprimée`);
        }
        
        console.log("\n✨ Base de données vidée avec succès!");
        console.log(`   ${collections.length} collection(s) supprimée(s)`);
        
    } catch (error) {
        console.error("❌ Erreur lors de la suppression de la base de données:");
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("\n🔌 Déconnexion de la base de données.");
        process.exit(0);
    }
}

// Run the script
clearDatabase();

