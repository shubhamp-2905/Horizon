/**
 * Authoritative Google Sheets Source of Truth for Horizon
 * Tab 1: gid=982498908 (7 Project Types & Descriptions)
 * Tab 2: gid=1269935198 (29 Assessment Factors across 3 Sections)
 */

export interface SpreadsheetProjectType {
  id: string;
  title: string;
  user_profile: string;
  description: string;
}

export interface SpreadsheetFactor {
  id: string;
  label: string;
  section: string;
  factor_type: 'Risk' | 'Opportunity';
  source: string;
  scoring_method: string;
  metric: string;
  options: string[];
  relevance: string[];
}

export interface SpreadsheetSection {
  id: string;
  title: string;
  icon: string;
  description?: string;
}

export const SPREADSHEET_PROJECT_TYPES: Record<string, SpreadsheetProjectType> = {
  'Real Estate Development': {
    id: 'Real Estate Development',
    title: 'Real Estate Development',
    user_profile: 'Developer',
    description: 'Residential, commercial, and mixed-use real estate development projects requiring comprehensive land title, environmental risk, and infrastructure suitability assessments.',
  },
  'Manufacturing and Industry': {
    id: 'Manufacturing and Industry',
    title: 'Manufacturing and Industry',
    user_profile: 'Site Selection Specialist',
    description: 'Industrial facilities, factories, warehousing, and processing plants requiring robust logistics access, heavy utility infrastructure, and environmental buffer verification.',
  },
  'Urban Planning and Architecture': {
    id: 'Urban Planning and Architecture',
    title: 'Urban Planning and Architecture',
    user_profile: 'Master Planner',
    description: 'Municipal, regional, and district-level master plans integrating zoning compliance, civic density, transport links, and ecological conservation buffers.',
  },
  'Infrastructure Finance': {
    id: 'Infrastructure Finance',
    title: 'Infrastructure Finance',
    user_profile: 'Investment Analyst',
    description: 'Public-private partnerships and capital deployment for transport, utility, and municipal infrastructure projects demanding rigorous legal tenure and debt covenants.',
  },
  'Energy Development': {
    id: 'Energy Development',
    title: 'Energy Development',
    user_profile: 'Resource Assessor',
    description: 'Utility-scale solar, wind, biomass, and microgrid installations evaluating grid interconnection proximity, terrain slope, solar irradiance, and land acquisition.',
  },
  'Agriculture': {
    id: 'Agriculture',
    title: 'Agriculture',
    user_profile: 'Agronomist',
    description: 'Commercial farming, agribusiness, and agroforestry ventures requiring verified soil quality, sustainable water table depth, and customary land rights confirmation.',
  },
  'Community & Advocacy': {
    id: 'Community & Advocacy',
    title: 'Community & Advocacy',
    user_profile: 'Advocate',
    description: 'Civil society organizations, indigenous land trusts, and public advocacy groups auditing land tenure security, customary rights, and community consent.',
  },
};

export const SPREADSHEET_SECTIONS: SpreadsheetSection[] = [
  { id: 'tenure_governance', title: 'Tenure & Governance', icon: '🏛️' },
  { id: 'environmental_climatic', title: 'Environmental & Climatic', icon: '🌿' },
  { id: 'development_suitability', title: 'Development Suitability', icon: '🏗️' },
];

export const SPREADSHEET_FACTORS: SpreadsheetFactor[] = [
  // Section 1: Tenure & Governance
  {
    id: 'disputed_ownership',
    label: 'Disputed Ownership',
    section: 'Tenure & Governance',
    factor_type: 'Risk',
    source: 'National Land Commission Registry',
    scoring_method: 'Binary: Active dispute on record = High Risk',
    metric: 'Presence of active adverse claims or lis pendens',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Manufacturing and Industry', 'Infrastructure Finance', 'Community & Advocacy'],
  },
  {
    id: 'customary_informal_tenure_overlap',
    label: 'Customary / Informal Tenure Overlap',
    section: 'Tenure & Governance',
    factor_type: 'Risk',
    source: 'Cadastral Overlay / Community Mapping',
    scoring_method: 'Binary: Unregistered community claims present = High Risk',
    metric: 'Overlap with recognized community or indigenous claims',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Agriculture', 'Energy Development', 'Infrastructure Finance', 'Community & Advocacy'],
  },
  {
    id: 'regulatory_compliance_enforcement_gap',
    label: 'Regulatory Compliance & Enforcement Gap',
    section: 'Tenure & Governance',
    factor_type: 'Risk',
    source: 'Municipal Planning Authority Notices',
    scoring_method: 'Binary: Prior enforcement action = High Risk',
    metric: 'History of unapproved development or stop-work orders',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Urban Planning and Architecture', 'Manufacturing and Industry'],
  },
  {
    id: 'overlapping_jurisdiction',
    label: 'Overlapping Jurisdiction',
    section: 'Tenure & Governance',
    factor_type: 'Risk',
    source: 'County / Municipal Boundary Gazette',
    scoring_method: 'Binary: Sits in disputed boundary zone = Medium/High Risk',
    metric: 'Contested municipal or county administrative boundary',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Infrastructure Finance', 'Urban Planning and Architecture'],
  },
  {
    id: 'unresolved_expropriation_easement_claims',
    label: 'Unresolved Expropriation / Easement Claims',
    section: 'Tenure & Governance',
    factor_type: 'Risk',
    source: 'Gazette Notices / Infrastructure Corridors',
    scoring_method: 'Binary: Uncompensated compulsory acquisition = High Risk',
    metric: 'Pending public easement or road widening corridor',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Infrastructure Finance', 'Manufacturing and Industry'],
  },
  {
    id: 'formal_land_registration',
    label: 'Formal Land Registration (Clean Freehold/Leasehold)',
    section: 'Tenure & Governance',
    factor_type: 'Opportunity',
    source: 'Ministry of Lands Digital Registry',
    scoring_method: 'Binary: Clean titled parcel with no encumbrances',
    metric: 'Certificate of Title registered and verified in digital registry',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Real Estate Development', 'Manufacturing and Industry', 'Infrastructure Finance', 'Energy Development'],
  },
  {
    id: 'community_buy_in_fpic_potential',
    label: 'Community Buy-In & FPIC Potential',
    section: 'Tenure & Governance',
    factor_type: 'Opportunity',
    source: 'Community Engagement Records / Stakeholder Forums',
    scoring_method: 'Categorical: Documented community support / valid FPIC pathway',
    metric: 'Prior community consultation meetings with recorded consent',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Agriculture', 'Energy Development', 'Community & Advocacy'],
  },
  {
    id: 'clear_zoning_designation',
    label: 'Clear Zoning Designation',
    section: 'Tenure & Governance',
    factor_type: 'Opportunity',
    source: 'Municipal Master Plan / Zoning Schedule',
    scoring_method: 'Binary: Proposed use matches gazetted zoning',
    metric: 'Use is permitted by-right under current spatial development framework',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Real Estate Development', 'Urban Planning and Architecture', 'Manufacturing and Industry'],
  },

  // Section 2: Environmental & Climatic
  {
    id: 'flood_risk_wetland_encroachment',
    label: 'Flood Risk & Wetland Encroachment',
    section: 'Environmental & Climatic',
    factor_type: 'Risk',
    source: 'Hydrological Survey / Flood Hazard Map',
    scoring_method: 'Categorical: 100-year floodplain = High; buffer zone = Medium',
    metric: 'Proximity to natural watercourses and 100-year flood line',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Urban Planning and Architecture', 'Infrastructure Finance', 'Agriculture'],
  },
  {
    id: 'steep_slope_landslide_susceptibility',
    label: 'Steep Slope & Landslide Susceptibility',
    section: 'Environmental & Climatic',
    factor_type: 'Risk',
    source: 'Digital Elevation Model (DEM) / Geological Survey',
    scoring_method: 'Continuous: Slope > 20% = High Risk; 10-20% = Moderate Risk',
    metric: 'Maximum terrain gradient across developable footprint',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Infrastructure Finance', 'Energy Development'],
  },
  {
    id: 'soil_contamination_industrial_legacy',
    label: 'Soil Contamination & Industrial Legacy',
    section: 'Environmental & Climatic',
    factor_type: 'Risk',
    source: 'Historical Land Use Records / Phase I ESA',
    scoring_method: 'Binary: Prior heavy industry/dumpsite on site or adjacent = High Risk',
    metric: 'Known brownfield status or chemical storage history',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Manufacturing and Industry', 'Real Estate Development', 'Urban Planning and Architecture'],
  },
  {
    id: 'protected_ecosystem_proximity',
    label: 'Protected Ecosystem Proximity',
    section: 'Environmental & Climatic',
    factor_type: 'Risk',
    source: 'Protected Planet / National Parks Gazette',
    scoring_method: 'Categorical: < 1 km from protected area = High; < 5 km = Medium',
    metric: 'Distance to nearest gazetted forest, park, or wildlife corridor',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Agriculture', 'Energy Development', 'Infrastructure Finance', 'Community & Advocacy'],
  },
  {
    id: 'water_stress_aquifer_depletion',
    label: 'Water Stress & Aquifer Depletion',
    section: 'Environmental & Climatic',
    factor_type: 'Risk',
    source: 'Aqueduct Water Risk Atlas / WRMA Data',
    scoring_method: 'Categorical: Baseline water stress rated High/Extremely High',
    metric: 'Aquifer drawdown rate and seasonal water deficit indicators',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Agriculture', 'Manufacturing and Industry', 'Energy Development'],
  },
  {
    id: 'wildfire_drought_exposure',
    label: 'Wildfire / Extreme Drought Exposure',
    section: 'Environmental & Climatic',
    factor_type: 'Risk',
    source: 'Meteorological Department / Historical Climate Index',
    scoring_method: 'Categorical: High historical frequency of extreme heat/drought',
    metric: 'Days per year exceeding critical temperature/fire danger threshold',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Agriculture', 'Energy Development'],
  },
  {
    id: 'high_solar_wind_resource_potential',
    label: 'High Solar / Wind Resource Potential',
    section: 'Environmental & Climatic',
    factor_type: 'Opportunity',
    source: 'Global Solar Atlas / Global Wind Atlas',
    scoring_method: 'Continuous: GHI > 5.0 kWh/m²/day or Wind > 6.5 m/s at 100m',
    metric: 'Global Horizontal Irradiance (GHI) or Mean Wind Speed',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Energy Development'],
  },
  {
    id: 'natural_drainage_good_permeability',
    label: 'Natural Drainage & Good Soil Permeability',
    section: 'Environmental & Climatic',
    factor_type: 'Opportunity',
    source: 'Geotechnical Soil Survey / Infiltration Tests',
    scoring_method: 'Binary: Sandy-loam / gravel with favorable percolation rate',
    metric: 'Soil percolation rate suitable for stormwater management without retention basining',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Real Estate Development', 'Urban Planning and Architecture', 'Agriculture'],
  },
  {
    id: 'microclimate_amenity_potential',
    label: 'Microclimate & Natural Amenity Potential',
    section: 'Environmental & Climatic',
    factor_type: 'Opportunity',
    source: 'Landscape Survey / Canopy Cover Mapping',
    scoring_method: 'Categorical: Mature tree cover, natural breezes, scenic views',
    metric: 'Percentage of parcel with mature tree canopy and cooling breezes',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Real Estate Development', 'Urban Planning and Architecture'],
  },
  {
    id: 'carbon_offset_biodiversity_credit_potential',
    label: 'Carbon Offset / Biodiversity Credit Potential',
    section: 'Environmental & Climatic',
    factor_type: 'Opportunity',
    source: 'Carbon Stock Assessment / Flora-Fauna Baseline',
    scoring_method: 'Continuous: Quantified potential for certified carbon or biodiversity credits',
    metric: 'Estimated metric tons CO2e sequesterable per hectare per year',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Agriculture', 'Community & Advocacy', 'Energy Development'],
  },

  // Section 3: Development Suitability
  {
    id: 'poor_road_connectivity_last_mile_gap',
    label: 'Poor Road Connectivity / Last-Mile Access Gap',
    section: 'Development Suitability',
    factor_type: 'Risk',
    source: 'Highways Authority Classification / Road Inventory',
    scoring_method: 'Categorical: No all-weather access road = High Risk; unpaved = Medium',
    metric: 'Distance to nearest paved arterial road (km)',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Manufacturing and Industry', 'Real Estate Development', 'Agriculture', 'Infrastructure Finance'],
  },
  {
    id: 'electrical_grid_distance_capacity_deficit',
    label: 'Electrical Grid Distance / Substation Capacity Deficit',
    section: 'Development Suitability',
    factor_type: 'Risk',
    source: 'Utility Grid Map / Power Corporation Connection Studies',
    scoring_method: 'Continuous: Distance > 3 km from high-voltage line or substation congested',
    metric: 'Distance to interconnection substation and available feed capacity (MVA)',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Energy Development', 'Manufacturing and Industry', 'Real Estate Development'],
  },
  {
    id: 'inadequate_water_sanitation_mains',
    label: 'Inadequate Water & Sanitation Infrastructure',
    section: 'Development Suitability',
    factor_type: 'Risk',
    source: 'Municipal Water & Sewerage Company Utility Map',
    scoring_method: 'Binary: No trunk water/sewer line within 1 km',
    metric: 'Distance to municipal water main and sewer trunk connection point',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Manufacturing and Industry', 'Urban Planning and Architecture'],
  },
  {
    id: 'high_excavation_fill_cost',
    label: 'High Excavation & Cut-and-Fill Requirements',
    section: 'Development Suitability',
    factor_type: 'Risk',
    source: 'Topographical Survey / Soil Boring Data',
    scoring_method: 'Categorical: Rugged terrain requiring substantial retaining structures',
    metric: 'Estimated cut-and-fill volume per developable hectare (m³)',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Manufacturing and Industry'],
  },
  {
    id: 'incompatible_neighboring_land_uses',
    label: 'Incompatible Neighboring Land Uses',
    section: 'Development Suitability',
    factor_type: 'Risk',
    source: 'Surrounding Land Use Survey',
    scoring_method: 'Binary: Abutting noxious industry, quarry, or landfill = High Risk',
    metric: 'Presence of incompatible or hazardous land uses within 500m radius',
    options: ['Risk Present', 'Risk Not Detected', 'Inconclusive / Requires Investigation'],
    relevance: ['Real Estate Development', 'Urban Planning and Architecture'],
  },
  {
    id: 'immediate_arterial_road_frontage',
    label: 'Immediate Arterial Road Frontage',
    section: 'Development Suitability',
    factor_type: 'Opportunity',
    source: 'Transport Master Plan / Cadastral Boundary',
    scoring_method: 'Binary: Direct frontage onto dual-carriageway or primary arterial',
    metric: 'Length of direct paved road frontage (linear meters)',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Real Estate Development', 'Manufacturing and Industry', 'Infrastructure Finance'],
  },
  {
    id: 'existing_utility_corridors_on_site',
    label: 'Existing High-Capacity Utility Corridors on Site',
    section: 'Development Suitability',
    factor_type: 'Opportunity',
    source: 'Utility Wayleave Records / As-Built Drawings',
    scoring_method: 'Binary: On-site fiber, 3-phase power, or municipal trunk lines',
    metric: 'Available capacity of existing on-site utility connections',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Manufacturing and Industry', 'Real Estate Development', 'Energy Development'],
  },
  {
    id: 'flat_regular_topography',
    label: 'Flat, Regular Topography (Low Grading Cost)',
    section: 'Development Suitability',
    factor_type: 'Opportunity',
    source: 'LiDAR Survey / Topographic Elevation Model',
    scoring_method: 'Binary: Average slope < 3% across entire usable parcel',
    metric: 'Average grade variation and rectangularity ratio of parcel shape',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Manufacturing and Industry', 'Energy Development', 'Agriculture', 'Real Estate Development'],
  },
  {
    id: 'planned_public_transit_corridor',
    label: 'Proximity to Planned Public Transit Corridor (TOD Potential)',
    section: 'Development Suitability',
    factor_type: 'Opportunity',
    source: 'Urban Transit Master Plan / BRT / Commuter Rail Gazette',
    scoring_method: 'Categorical: Within 800m (10-min walk) of gazetted transit station',
    metric: 'Walking distance to current or gazetted public rapid transit hub',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Real Estate Development', 'Urban Planning and Architecture'],
  },
  {
    id: 'favorable_geotechnical_bearing_capacity',
    label: 'Favorable Geotechnical Bearing Capacity',
    section: 'Development Suitability',
    factor_type: 'Opportunity',
    source: 'Geotechnical Borehole Investigation',
    scoring_method: 'Binary: Competent bedrock or dense gravel at shallow depth (< 2m)',
    metric: 'Standard Penetration Test (SPT) N-values > 30 allowing shallow foundation design',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Real Estate Development', 'Manufacturing and Industry', 'Infrastructure Finance'],
  },
  {
    id: 'special_economic_zone_incentives',
    label: 'Special Economic Zone / Export Processing Incentives',
    section: 'Development Suitability',
    factor_type: 'Opportunity',
    source: 'SEZ Authority Gazette / Investment Authority',
    scoring_method: 'Binary: Parcel gazetted within active SEZ/EPZ fiscal incentive boundary',
    metric: 'Applicable corporate tax abatement, import tariff exemption, or fast-track permitting',
    options: ['Opportunity Identified / Present', 'Not Present', 'Uncertain'],
    relevance: ['Manufacturing and Industry', 'Infrastructure Finance'],
  },
];
