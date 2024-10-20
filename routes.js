// Import required modules
const axios = require('axios');
const turf = require('@turf/turf');

// 1. Get routes from Google Maps API
const API_KEY = 'AIzaSyBvEAjxAz-90pHpfVch_0fiZvagwf39BhU';

async function getRoutes(origin, destination) {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}&mode=walking&key=${API_KEY}&alternatives=true`;

    const response = await axios.get(url);
    const routes = response.data.routes;

    if (routes.length === 0) {
      console.log('No routes found');
      return [];
    }

    console.log(`Found ${routes.length} walking routes:`);

    // Process each route to extract coordinates
    const routeCoordinates = routes.map((route, index) => {
      console.log(`Route ${index + 1}:`);
      console.log(`- Distance: ${route.legs[0].distance.text}`);
      console.log(`- Duration: ${route.legs[0].duration.text}`);
      console.log(`- Summary: ${route.summary}`);

      // Extract coordinates for each step in the route
      const coordinates = [];
      route.legs[0].steps.forEach((step) => {
        coordinates.push([step.start_location.lng, step.start_location.lat]); // Start of step
        coordinates.push([step.end_location.lng, step.end_location.lat]);     // End of step
      });

      return {
        name: `Route ${index + 1}`,
        coords: coordinates
      };
    });

    return routeCoordinates; // Return all routes with their coordinates
  } catch (error) {
    console.error('Error fetching routes:', error.message);
    return [];
  }
}

// 2. Get crime data from Toronto Major Crime Indicators API
const CRIME_DATA_URL = 'https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/Major_Crime_Indicators_Open_Data/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson';

async function getCrimeDataToronto() {
  try {
    const response = await axios.get(CRIME_DATA_URL);
    const crimeData = response.data;

    console.log(`Fetched ${crimeData.features.length} crime incidents.`);
    return crimeData.features; // Returns array of crime incidents
  } catch (error) {
    console.error('Error fetching crime data:', error.message);
    return [];
  }
}

// 3. Filter crime incidents along a route
function filterCrimeByProximity(crimeData, routeCoords, radiusMeters = 500) {
  return crimeData.filter((incident) => {
    const crimeLat = incident.geometry.coordinates[1];
    const crimeLng = incident.geometry.coordinates[0];

    // Iterate over the route coordinates to find nearby crimes
    for (let coord of routeCoords) {
      const from = turf.point([crimeLng, crimeLat]); // Crime location
      const to = turf.point(coord); // Route location
      const distance = turf.distance(from, to, { units: 'meters' });

      // Return crimes within the radius
      if (distance <= radiusMeters) {
        return true;
      }
    }
    return false;
  });
}

// 4. Calculate a crime-based safety score
function calculateCrimeImpact(crimeData) {
  const crimeWeight = -0.5; // Negative weight for crimes
  const crimeScore = crimeWeight * crimeData.length; // More crimes = lower score

  return crimeScore;
}

// 5. Selecting the safest route
async function getSafestRoute(origin, destination) {
  const routes = await getRoutes(origin, destination); // Fetch routes
  const crimeData = await getCrimeDataToronto();       // Fetch crime data

  let safestRoute = null;
  let bestScore = -Infinity;

  // Iterate over each route
  routes.forEach((route) => {
    // Filter crimes near the route
    const nearbyCrimes = filterCrimeByProximity(crimeData, route.coords);

    // Calculate crime score for this route
    const crimeScore = calculateCrimeImpact(nearbyCrimes);

    console.log(`Crime-based safety score for ${route.name}: ${crimeScore}`);

    // Select the route with the best (highest) score
    if (crimeScore > bestScore) {
      bestScore = crimeScore;
      safestRoute = route;
    }
  });

  // Print out the safest route
  if (safestRoute) {
    console.log('Safest route:', safestRoute);
  } else {
    console.log('No safe route found.');
  }

  return safestRoute;
}

// Example usage
const origin = 'University of Toronto, Toronto, ON';
const destination = 'Bloor–Yonge Station, 2 Bloor St E, Toronto, ON M4W 1A8';

getSafestRoute(origin, destination);
