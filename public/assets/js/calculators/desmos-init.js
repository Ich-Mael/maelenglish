/**
 * Initialisation des calculatrices Desmos
 * Graphique et Scientifique
 */
(function() {
  'use strict';

  // Vérifier que Desmos est chargé
  if (typeof Desmos === 'undefined') {
    console.error('Desmos API not loaded');
    return;
  }

  let graphingCalculator = null;
  let scientificCalculator = null;

  // Initialiser la calculatrice graphique
  function initGraphingCalculator() {
    const elt = document.getElementById('desmos-graphing-calculator');
    if (!elt) return;

    // Détruire l'instance précédente si elle existe
    if (graphingCalculator) {
      graphingCalculator.destroy();
    }

    graphingCalculator = Desmos.GraphingCalculator(elt, {
      keypad: true,
      zoomButtons: true,
      expressions: true,
      settingsMenu: true,
      lockViewport: false,
      expressionsCollapsed: false,
      expressionsTopbar: true
    });

    // Configuration en français
    graphingCalculator.updateSettings({
      language: 'fr'
    });
  }

  // Initialiser la calculatrice scientifique
  function initScientificCalculator() {
    const elt = document.getElementById('desmos-scientific-calculator');
    if (!elt) return;

    // Détruire l'instance précédente si elle existe
    if (scientificCalculator) {
      scientificCalculator.destroy();
    }

    scientificCalculator = Desmos.ScientificCalculator(elt);
    scientificCalculator.updateSettings({
      language: 'fr'
    });
  }

  // Initialiser quand le DOM est prêt
  document.addEventListener('DOMContentLoaded', function() {
    // Graphing Calculator - Initialiser quand le modal est affiché
    const graphModal = document.getElementById('graph-calc-modal');
    if (graphModal) {
      graphModal.addEventListener('shown.bs.modal', function() {
        setTimeout(function() {
          initGraphingCalculator();
        }, 100);
      });

      // Nettoyer lors de la fermeture du modal
      graphModal.addEventListener('hidden.bs.modal', function() {
        if (graphingCalculator) {
          graphingCalculator.destroy();
          graphingCalculator = null;
        }
      });
    }

    // Scientific Calculator - Initialiser quand le modal est affiché
    const scienModal = document.getElementById('scien-calc-modal');
    if (scienModal) {
      scienModal.addEventListener('shown.bs.modal', function() {
        setTimeout(function() {
          initScientificCalculator();
        }, 100);
      });

      // Nettoyer lors de la fermeture du modal
      scienModal.addEventListener('hidden.bs.modal', function() {
        if (scientificCalculator) {
          scientificCalculator.destroy();
          scientificCalculator = null;
        }
      });
    }
  });
})();

