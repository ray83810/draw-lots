/**
 * DrawEngine - Handles weighted drawing algorithms, probabilities, and pool states.
 */
class DrawEngine {
  /**
   * Generates a unique ID.
   * @returns {string}
   */
  static generateId() {
    return 'c_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Calculates the drawing probabilities for all candidates in the current list.
   * @param {Array} candidates - List of all candidates.
   * @param {Array} drawnIds - List of IDs that have already been drawn (for preventRepeat mode).
   * @param {boolean} preventRepeat - Whether preventRepeat mode is active.
   * @returns {Object} Mapping of candidate ID to percentage probability (0-100).
   */
  static calculateProbabilities(candidates, drawnIds, preventRepeat) {
    const probabilities = {};
    
    // Get eligible candidates
    const eligible = candidates.filter(c => {
      if (!c.active) return false;
      if (preventRepeat && drawnIds.includes(c.id)) return false;
      return true;
    });

    const totalWeight = eligible.reduce((sum, c) => sum + parseFloat(c.weight || 1), 0);

    candidates.forEach(c => {
      if (!c.active) {
        probabilities[c.id] = 0;
      } else if (preventRepeat && drawnIds.includes(c.id)) {
        probabilities[c.id] = 0;
      } else {
        const weight = parseFloat(c.weight || 1);
        probabilities[c.id] = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      }
    });

    return {
      probabilities,
      totalWeight,
      eligibleCount: eligible.length
    };
  }

  /**
   * Selects a single candidate using weighted random selection.
   * @param {Array} eligibleCandidates - List of active, non-drawn candidates.
   * @returns {Object|null} Selected candidate.
   */
  static drawSingle(eligibleCandidates) {
    if (eligibleCandidates.length === 0) return null;

    const totalWeight = eligibleCandidates.reduce((sum, c) => sum + parseFloat(c.weight || 1), 0);
    if (totalWeight <= 0) {
      // If weights are 0, pick uniformly
      const randIndex = Math.floor(Math.random() * eligibleCandidates.length);
      return eligibleCandidates[randIndex];
    }

    const random = Math.random() * totalWeight;
    let accumulatedWeight = 0;

    for (const candidate of eligibleCandidates) {
      accumulatedWeight += parseFloat(candidate.weight || 1);
      if (random <= accumulatedWeight) {
        return candidate;
      }
    }

    // Fallback in case of rounding errors
    return eligibleCandidates[eligibleCandidates.length - 1];
  }

  /**
   * Performs drawing for a specified count.
   * @param {Array} candidates - List of all candidates.
   * @param {number} count - Number of candidates to draw.
   * @param {boolean} preventRepeat - Whether preventRepeat mode is active.
   * @param {Array} currentDrawnIds - Array of already drawn IDs (will be modified in-place if preventRepeat is true).
   * @returns {Object} Object containing array of winners and whether the pool had to be auto-reset.
   */
  static drawMultiple(candidates, count, preventRepeat, currentDrawnIds) {
    const winners = [];
    let poolResetOccurred = false;
    let tempDrawnIds = [...currentDrawnIds];

    // Filter active candidates
    const activeCandidates = candidates.filter(c => c.active);
    if (activeCandidates.length === 0) {
      return { winners, poolResetOccurred, updatedDrawnIds: currentDrawnIds };
    }

    for (let i = 0; i < count; i++) {
      // Find who is eligible
      let eligible = activeCandidates.filter(c => !preventRepeat || !tempDrawnIds.includes(c.id));

      // If pool is empty because of preventRepeat, reset it
      if (preventRepeat && eligible.length === 0) {
        tempDrawnIds = [];
        poolResetOccurred = true;
        eligible = [...activeCandidates];
      }

      // Draw one
      const winner = this.drawSingle(eligible);
      if (winner) {
        winners.push(winner);
        if (preventRepeat) {
          tempDrawnIds.push(winner.id);
        }
      } else {
        break; // No more can be drawn
      }
    }

    return {
      winners,
      poolResetOccurred,
      updatedDrawnIds: tempDrawnIds
    };
  }
}

// Export for browser
window.DrawEngine = DrawEngine;
