import { NormalizedFlight, ScoreBreakdown } from '../common/types';

/**
 * Ranking Engine
 * Scores flights based on price, duration, and stops
 * Can be extended with ML models or more complex logic
 */
export class RankingEngine {
  // Weights for scoring (must sum to 1.0)
  private priceWeight = 0.6; // Price is most important (60%)
  private durationWeight = 0.25; // Duration is secondary (25%)
  private stopsWeight = 0.15; // Stops matter least (15%)

  /**
   * Rank and sort flights
   * Returns flights sorted by score (highest first)
   */
  rankFlights(flights: NormalizedFlight[]): NormalizedFlight[] {
    if (flights.length === 0) {
      return [];
    }

    // Calculate scores for all flights
    const scoredFlights = flights.map((flight) => ({
      ...flight,
      rankingScore: this.calculateScore(flight, flights),
      scoreBreakdown: this.getScoreBreakdown(flight, flights),
    }));

    // Sort by score descending (higher score = better)
    return scoredFlights.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
  }

  /**
   * Calculate overall score for a flight
   * Score range: 0-100
   */
  private calculateScore(flight: NormalizedFlight, allFlights: NormalizedFlight[]): number {
    const priceComponent = this.scorePriceComponent(flight, allFlights);
    const durationComponent = this.scoreDurationComponent(flight, allFlights);
    const stopsComponent = this.scoreStopsComponent(flight, allFlights);

    const score =
      priceComponent * this.priceWeight +
      durationComponent * this.durationWeight +
      stopsComponent * this.stopsWeight;

    return Math.round(score * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get detailed score breakdown for a flight
   */
  private getScoreBreakdown(flight: NormalizedFlight, allFlights: NormalizedFlight[]): ScoreBreakdown {
    const priceScore = this.scorePriceComponent(flight, allFlights);
    const durationScore = this.scoreDurationComponent(flight, allFlights);
    const stopsScore = this.scoreStopsComponent(flight, allFlights);

    return {
      priceScore: Math.round(priceScore * 100) / 100,
      durationScore: Math.round(durationScore * 100) / 100,
      stopsScore: Math.round(stopsScore * 100) / 100,
      totalScore:
        Math.round(
          (priceScore * this.priceWeight +
            durationScore * this.durationWeight +
            stopsScore * this.stopsWeight) *
            100,
        ) / 100,
    };
  }

  /**
   * Score price component (0-100)
   * Cheapest flight gets 100, most expensive gets lower score
   */
  private scorePriceComponent(flight: NormalizedFlight, allFlights: NormalizedFlight[]): number {
    const prices = allFlights.map((f) => f.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
      return 100; // All flights same price
    }

    // Inverse scoring: lower price = higher score
    const normalizedPrice = (flight.price - minPrice) / (maxPrice - minPrice);
    return 100 * (1 - normalizedPrice);
  }

  /**
   * Score duration component (0-100)
   * Shortest flight gets 100, longest gets lower score
   */
  private scoreDurationComponent(flight: NormalizedFlight, allFlights: NormalizedFlight[]): number {
    const durations = allFlights.map((f) => f.duration);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    if (minDuration === maxDuration) {
      return 100; // All flights same duration
    }

    // Inverse scoring: shorter duration = higher score
    const normalizedDuration = (flight.duration - minDuration) / (maxDuration - minDuration);
    return 100 * (1 - normalizedDuration);
  }

  /**
   * Score stops component (0-100)
   * Non-stop flight gets 100, more stops means lower score
   */
  private scoreStopsComponent(flight: NormalizedFlight, allFlights: NormalizedFlight[]): number {
    const stopCounts = allFlights.map((f) => f.stops);
    const maxStops = Math.max(...stopCounts);

    if (maxStops === 0) {
      // All flights are non-stop
      return 100;
    }

    // Inverse scoring: fewer stops = higher score
    // Non-stop = 100, each additional stop reduces score
    return 100 * (1 - flight.stops / maxStops);
  }

  /**
   * Filter flights by criteria
   */
  filterFlights(
    flights: NormalizedFlight[],
    criteria: {
      maxPrice?: number;
      maxStops?: number;
      maxDuration?: number; // In minutes
      airlines?: string[]; // Which airlines to include
      minStars?: number; // If we had ratings
    },
  ): NormalizedFlight[] {
    return flights.filter((flight) => {
      if (criteria.maxPrice && flight.price > criteria.maxPrice) {
        return false;
      }

      if (criteria.maxStops !== undefined && flight.stops > criteria.maxStops) {
        return false;
      }

      if (criteria.maxDuration && flight.duration > criteria.maxDuration) {
        return false;
      }

      if (criteria.airlines && !criteria.airlines.includes(flight.airlineCode)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Calculate price statistics for a set of flights
   */
  getPriceStats(flights: NormalizedFlight[]): {
    min: number;
    max: number;
    average: number;
    median: number;
  } {
    if (flights.length === 0) {
      return { min: 0, max: 0, average: 0, median: 0 };
    }

    const prices = flights.map((f) => f.price).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;

    // Calculate median
    const median =
      prices.length % 2 === 0
        ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : prices[Math.floor(prices.length / 2)];

    return {
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      average: Math.round(average * 100) / 100,
      median: Math.round(median * 100) / 100,
    };
  }

  /**
   * Set custom weights for scoring
   * Useful for A/B testing different ranking strategies
   */
  setWeights(priceWeight: number, durationWeight: number, stopsWeight: number): void {
    const total = priceWeight + durationWeight + stopsWeight;
    if (Math.abs(total - 1.0) > 0.01) {
      throw new Error('Weights must sum to 1.0');
    }

    this.priceWeight = priceWeight;
    this.durationWeight = durationWeight;
    this.stopsWeight = stopsWeight;
  }
}

/**
 * Export singleton instance
 */
export const rankingEngine = new RankingEngine();
