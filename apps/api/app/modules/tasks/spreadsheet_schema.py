"""
Authoritative Spreadsheet Schema Mapping for Project Horizon.
Derived strictly from the two official Google Sheets source tabs:
- Tab 1 (gid 982498908): Project Types, User Profiles, and Descriptions
- Tab 2 (gid 1269935198): Land Suitability & Risk Assessment Factors (Tenure, Environmental, Development)
"""

from typing import Dict, Any, List, Optional
import re


PROJECT_TYPES: Dict[str, Dict[str, str]] = {
    "Real Estate Development": {
        "title": "Real Estate Development",
        "user_profile": "Developers, property investors, and planners assessing site viability",
        "description": "Buildable land for residential, commercial, or mixed-use projects, prioritized by zoning compatibility, infrastructure access, and permitting readiness.",
        "slug": "real_estate",
    },
    "Manufacturing and Industry": {
        "title": "Manufacturing and Industry",
        "user_profile": "Logistics firms, industrial multinationals, investors in production facilities",
        "description": "Sites suitable for factories, logistics, or processing facilities, selected based on proximity to utilities, transport corridors, and industrial zones.",
        "slug": "manufacturing",
    },
    "Urban Planning and Architecture": {
        "title": "Urban Planning and Architecture",
        "user_profile": "Architects, urban designers, municipal planning teams",
        "description": "Parcels for urban expansion, civic infrastructure, or public space design, emphasizing ecological context, demographic access, and growth alignment.",
        "slug": "urban_planning",
    },
    "Infrastructure Finance": {
        "title": "Infrastructure Finance",
        "user_profile": "Infrastructure funds, DFIs, public agencies investing in public infrastructure",
        "description": "Capital-ready land for large-scale transport, utility, or institutional infrastructure, optimized for governance clarity, timeline efficiency, and ESG compliance.",
        "slug": "infrastructure_finance",
    },
    "Energy Development": {
        "title": "Energy Development",
        "user_profile": "Renewable energy developers, projects targeting wind, solar, or hybrid systems",
        "description": "Land with high solar or wind generation potential, grid access, and minimal ecological or social disruption, ideal for renewable energy deployment.",
        "slug": "energy_development",
    },
    "Agriculture": {
        "title": "Agriculture",
        "user_profile": "Agribusinesses, regenerative farming networks, sustainable food system planners",
        "description": "Climate-aligned land for regenerative, subsistence, or commercial cultivation, selected for soil health, water access, and agroecological suitability.",
        "slug": "agriculture",
    },
    "Community & Advocacy": {
        "title": "Community & Advocacy",
        "user_profile": "Indigenous governance bodies, environmental NGOs, community land stewards",
        "description": "Territories under Indigenous or community governance, focused on boundary validation, encroachment monitoring, legal recognition, and conservation or co-management opportunities.",
        "slug": "community_advocacy",
    },
}

FACTOR_SECTIONS = [
    {
        "id": "tenure_governance",
        "title": "Tenure & Governance",
        "description": "Customary land overlap, formal title registry, overlapping claims, and governance authority.",
    },
    {
        "id": "environmental_climatic",
        "title": "Environmental & Climatic",
        "description": "Hydrological risks, canopy trends, habitat fragmentation, and ecological finance opportunities.",
    },
    {
        "id": "development_suitability",
        "title": "Development Suitability",
        "description": "Terrain slope, flood hazards, remoteness, zoning alignment, and utility connectivity.",
    },
]

RISK_OPTIONS = ["Risk Present", "Risk Not Detected", "Inconclusive / Requires Investigation"]
OPPORTUNITY_OPTIONS = ["Opportunity Identified / Present", "Not Present", "Uncertain"]

FACTORS_RAW: List[Dict[str, str]] = [
    # --- Tenure & Governance ---
    {
        "section_id": "tenure_governance",
        "factor": "Unrecognized Indigenous or customary land overlap",
        "type": "Risk",
        "source": "Local Indigenous governments, nonprofit mapping partners (e.g., Native Land, COICA, FAPI)",
        "scoring_method": "Proxy-based spatial overlay",
        "metric": "Boundary intersection with unrecognized Indigenous territories",
        "relevance": "Critical for Infrastructure, Energy, Real Estate; Relevant for Community & Advocacy",
    },
    {
        "section_id": "tenure_governance",
        "factor": "Absence of legal title in national registry",
        "type": "Risk",
        "source": "National cadastre authorities, land governance ministries",
        "scoring_method": "Registry lookup and spatial join",
        "metric": "Parcel has no match in formal land title registry",
        "relevance": "High relevance for all project types",
    },
    {
        "section_id": "tenure_governance",
        "factor": "Overlapping or disputed land claims",
        "type": "Risk",
        "source": "NGO monitoring data, legal case repositories",
        "scoring_method": "Conflict layer overlay and geometry comparison",
        "metric": "Multiple overlapping tenure claims within parcel boundary",
        "relevance": "High relevance for all project types",
    },
    {
        "section_id": "tenure_governance",
        "factor": "History of conflict or displacement",
        "type": "Risk",
        "source": "Human rights organizations, conflict zone mapping (e.g., ACLED)",
        "scoring_method": "Spatial overlay with known conflict zones",
        "metric": "Parcel intersects mapped conflict or displacement zones",
        "relevance": "Relevant for all project types, especially Advocacy and Infrastructure",
    },
    {
        "section_id": "tenure_governance",
        "factor": "Informal governance with no verifiable authority",
        "type": "Risk",
        "source": "Lack of registry, absence of infrastructure, long-term NDVI stability",
        "scoring_method": "Composite proxy model",
        "metric": "High probability of non-state or undocumented land administration",
        "relevance": "Critical for Finance, Infrastructure, Energy; Relevant for all",
    },
    {
        "section_id": "tenure_governance",
        "factor": "Opportunities for co-management or community partnerships",
        "type": "Opportunity",
        "source": "Community-based organizations, Indigenous governments, project developers",
        "scoring_method": "Narrative/contextual flag with user or partner input",
        "metric": "Presence of governance body open to engagement",
        "relevance": "Relevant for Energy, Agriculture, Urban Planning, Advocacy",
    },
    {
        "section_id": "tenure_governance",
        "factor": "Parcels aligned with national or regional development plans",
        "type": "Opportunity",
        "source": "Planning ministries, infrastructure authority datasets (where available)",
        "scoring_method": "Spatial overlay with planning datasets",
        "metric": "Parcel intersects published government development priority zones",
        "relevance": "Strategic for Infrastructure, Energy, Manufacturing",
    },
    {
        "section_id": "tenure_governance",
        "factor": "Eligibility for public-private or conservation finance programs",
        "type": "Opportunity",
        "source": "Donor registries, policy databases, REDD+ zones, VCM platforms",
        "scoring_method": "Narrative/qualitative assessment",
        "metric": "Located in areas eligible for green finance, biodiversity credits, or co-financing",
        "relevance": "Critical for Infrastructure, Conservation, Community",
    },

    # --- Environmental & Climatic ---
    {
        "section_id": "environmental_climatic",
        "factor": "High flood frequency",
        "type": "Risk",
        "source": "NOAA, SAR moisture indices (Sentinel-1)",
        "scoring_method": "Direct temporal analysis",
        "metric": ">=3 flood events in past 10 years",
        "relevance": "Critical for Infrastructure, Energy; Moderate for Agriculture, Real Estate",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "High drought frequency",
        "type": "Risk",
        "source": "NOAA drought indices, IPCC regional reports",
        "scoring_method": "Direct temporal analysis",
        "metric": ">=3 drought events in past 10 years",
        "relevance": "High for Agriculture, Energy; Relevant for Infrastructure",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "Severe canopy loss over time (>30%)",
        "type": "Risk",
        "source": "Sentinel-2, Landsat",
        "scoring_method": "Time series NDVI analysis",
        "metric": "Loss of >30% NDVI index over 5-year period",
        "relevance": "Relevant for Agriculture, Conservation, Real Estate",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "NDVI decline with bare soil expansion",
        "type": "Risk",
        "source": "Sentinel-2, Landsat",
        "scoring_method": "NDVI + land cover composite",
        "metric": "Bare soil increase + vegetation decline",
        "relevance": "Critical for Agriculture, Conservation",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "Proximity to protected or conservation areas",
        "type": "Risk",
        "source": "World Database on Protected Areas (UNEP-WCMC)",
        "scoring_method": "Buffer zone analysis",
        "metric": "Parcel within 1 km of nationally protected area",
        "relevance": "Risk for Energy, Infrastructure, Real Estate",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "Degraded or fragmented habitat zones",
        "type": "Risk",
        "source": "ESA land cover, national biodiversity data",
        "scoring_method": "Patch analysis on land cover",
        "metric": "High fragmentation (>5 patches per 10ha)",
        "relevance": "Relevant for Agriculture, Infrastructure, Real Estate",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "Carbon credit or restoration finance eligibility",
        "type": "Opportunity",
        "source": "IPCC soil carbon maps, ESA land degradation layers, Verified Carbon Standard",
        "scoring_method": "Composite inference + program eligibility cross-check",
        "metric": "Carbon stock potential + degraded land proximity + finance mechanism overlay",
        "relevance": "High for Agriculture, Community & Advocacy, Infrastructure",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "High solar or wind energy generation potential",
        "type": "Opportunity",
        "source": "Global Solar Atlas, NASA POWER, Copernicus, NREL",
        "scoring_method": "Direct environmental modeling",
        "metric": "Solar irradiance, wind speed (10m), terrain suitability",
        "relevance": "Critical for Energy; Relevant for Infrastructure",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "Agroecological zones suited for specific crops",
        "type": "Opportunity",
        "source": "IPCC climate zones, FAO ecozones, national ag data",
        "scoring_method": "Climate + soil crosswalk with crop models",
        "metric": "Climate match + soil suitability for target species",
        "relevance": "High for Agriculture",
    },
    {
        "section_id": "environmental_climatic",
        "factor": "Regenerating landscapes viable for sustainable land use",
        "type": "Opportunity",
        "source": "Sentinel-2, Landsat, ESA restoration masks",
        "scoring_method": "Time-series NDVI + historical land cover",
        "metric": "Land previously degraded showing multiyear recovery",
        "relevance": "High for Agriculture, Community & Advocacy",
    },

    # --- Development Suitability ---
    {
        "section_id": "development_suitability",
        "factor": "Steep slope",
        "type": "Risk",
        "source": "Digital Elevation Model (USGS, ESA)",
        "scoring_method": "Direct topographic analysis",
        "metric": "Average slope >15 deg",
        "relevance": "Barrier for Real Estate, Infrastructure; Opportunity for Agriculture, Urban Planning",
    },
    {
        "section_id": "development_suitability",
        "factor": "Located in a flood-prone area",
        "type": "Risk",
        "source": "National hydrological maps, SAR flood extent (Sentinel-1)",
        "scoring_method": "Direct flood zone mapping",
        "metric": "Parcel intersects designated floodplain",
        "relevance": "Risk for Infrastructure, Real Estate, Energy",
    },
    {
        "section_id": "development_suitability",
        "factor": "Remote location",
        "type": "Risk",
        "source": "OpenStreetMap, Sentinel-1 infrastructure detection",
        "scoring_method": "Proximity analysis",
        "metric": "Distance >5 km from road or settlement",
        "relevance": "Barrier for Manufacturing, Infrastructure, Energy",
    },
    {
        "section_id": "development_suitability",
        "factor": "Past industrial, mining, or monoculture use",
        "type": "Risk",
        "source": "Land cover time series (ESA, Landsat)",
        "scoring_method": "Land use history analysis",
        "metric": "Detected prior intensive or extractive use",
        "relevance": "Risk for Agriculture, Urban Planning",
    },
    {
        "section_id": "development_suitability",
        "factor": "High ecological fragmentation",
        "type": "Risk",
        "source": "ESA global land cover, Copernicus HRL",
        "scoring_method": "Land cover patch analysis",
        "metric": "5+ patches within parcel extent",
        "relevance": "Constraint for Agriculture, Greenfield Development",
    },
    {
        "section_id": "development_suitability",
        "factor": "Moderate to steep slopes suitable for specific uses",
        "type": "Opportunity",
        "source": "Digital Elevation Model (USGS, ESA)",
        "scoring_method": "Topographic classification",
        "metric": "Slopes between 10-30%",
        "relevance": "Opportunity for Agriculture, Urban Planning",
    },
    {
        "section_id": "development_suitability",
        "factor": "Flat, buildable terrain with low prep cost",
        "type": "Opportunity",
        "source": "DEM + Sentinel-2 + OpenLandMap",
        "scoring_method": "Slope + surface roughness analysis",
        "metric": "Slope <5 deg, stable soil cover",
        "relevance": "Enabler for Real Estate, Manufacturing",
    },
    {
        "section_id": "development_suitability",
        "factor": "Zoning-aligned parcels ready for target land use",
        "type": "Opportunity",
        "source": "Municipal land plans, national cadastral data",
        "scoring_method": "Zoning overlay and code match",
        "metric": "Project use matches existing zoning",
        "relevance": "Enabler for Real Estate, Manufacturing, Urban Planning",
    },
    {
        "section_id": "development_suitability",
        "factor": "Sites co-located with compatible industries or ESG-aligned capital zones",
        "type": "Opportunity",
        "source": "Investment zones, enterprise overlays, ESG fund regions",
        "scoring_method": "Cluster proximity analysis",
        "metric": "Proximity to existing industries or capital incentive zones",
        "relevance": "Strategic for Infrastructure, Manufacturing, Energy",
    },
    {
        "section_id": "development_suitability",
        "factor": "Infill or redevelopment sites inside growth zones",
        "type": "Opportunity",
        "source": "Municipal planning layers, OpenStreetMap, local zoning",
        "scoring_method": "Urban boundary overlay and past use detection",
        "metric": "Within city growth zone + prior use detected",
        "relevance": "Opportunity for Urban Planning, Real Estate",
    },
    {
        "section_id": "development_suitability",
        "factor": "Proximity to roads, utilities, and logistics hubs",
        "type": "Opportunity",
        "source": "OpenStreetMap, national infrastructure maps",
        "scoring_method": "Access scoring",
        "metric": "<=2 km to road, transmission, or facility",
        "relevance": "High for Manufacturing, Infrastructure, Energy",
    },
]

# ---------------------------------------------------------------------------
# 1. Yellow-Highlighted Factors in Loupe Risk & Opportunity Matrix
# Already measured by existing automated processes — EXCLUDED from contributor survey
# ---------------------------------------------------------------------------
EXCLUDED_YELLOW_FACTORS = [
    {
        "factor": "Unrecognized Indigenous or customary land overlap",
        "section_id": "tenure_governance",
        "category": "Tenure & Governance",
        "reason": "Measured via proxy-based spatial overlays with partner boundaries (Native Land, COICA, FAPI).",
    },
    {
        "factor": "NDVI decline with bare soil expansion",
        "section_id": "environmental_climatic",
        "category": "Environmental & Climatic",
        "reason": "Measured via satellite time-series composites (Sentinel-2, Landsat NDVI + land cover).",
    },
    {
        "factor": "Remote location",
        "section_id": "development_suitability",
        "category": "Development Suitability",
        "reason": "Measured via OpenStreetMap road/settlement proximity GIS distance calculation (>5 km).",
    },
    {
        "factor": "High ecological fragmentation",
        "section_id": "development_suitability",
        "category": "Development Suitability",
        "reason": "Measured via automated ESA/Copernicus land cover patch analysis.",
    },
    {
        "factor": "Zoning-aligned parcels ready for target land use",
        "section_id": "development_suitability",
        "category": "Development Suitability",
        "reason": "Measured via municipal cadastral zoning overlay and code-matching pipeline.",
    },
    {
        "factor": "Proximity to roads, utilities, and logistics hubs",
        "section_id": "development_suitability",
        "category": "Development Suitability",
        "reason": "Measured via OSM infrastructure access scoring algorithms (<=2 km buffer).",
    },
]

# ---------------------------------------------------------------------------
# 2. Factors measured via Backend / GIS / Remote Sensing / Registries
# Preserved as backend data pipeline responsibilities, NOT contributor field questions
# ---------------------------------------------------------------------------
BACKEND_GIS_FACTORS = [
    {
        "factor": "Absence of legal title in national registry",
        "method": "Registry lookup and spatial join (Ministry of Lands / National Cadastre)",
    },
    {
        "factor": "History of conflict or displacement",
        "method": "Spatial overlay with mapped conflict zones (ACLED, human rights GIS)",
    },
    {
        "factor": "Parcels aligned with national or regional development plans",
        "method": "Spatial overlay with published government planning zones",
    },
    {
        "factor": "Eligibility for public-private or conservation finance programs",
        "method": "Registry cross-check (VCM, REDD+, green finance directories)",
    },
    {
        "factor": "Severe canopy loss over time (>30%)",
        "method": "Multi-year Sentinel-2 / Landsat NDVI time-series regression",
    },
    {
        "factor": "Carbon credit or restoration finance eligibility",
        "method": "IPCC soil carbon maps + ESA degradation composite modeling",
    },
    {
        "factor": "High solar or wind energy generation potential",
        "method": "Global Solar Atlas / NASA POWER environmental simulation",
    },
    {
        "factor": "Agroecological zones suited for specific crops",
        "method": "FAO / IPCC climate & soil suitability crosswalk models",
    },
]

# ---------------------------------------------------------------------------
# 3. Streamlined Contributor Field Survey Question Bank (Max 10 questions)
# Categorized into: Tenure & Governance, Environmental & Climatic, Development Suitability
# ---------------------------------------------------------------------------
DEFAULT_OPTIONS_UNKNOWN = "Unknown / Unable to verify"

STREAMLINED_FIELD_QUESTIONS = [
    # --- Category 1: Tenure & Governance ---
    {
        "id": "land_ownership_status",
        "label": "Land ownership and registration status",
        "subcategory": "Ownership & Registration",
        "section_id": "tenure_governance",
        "section_title": "Tenure & Governance",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "Formal Title / Registered Leasehold",
            "Customary / Communal Land Holding",
            "Informal / Unregistered Possession",
            "Unknown / Unable to verify",
        ],
        "metric": "Observed title deeds, municipal placards, or community demarcation",
        "help_text": "Record observable evidence of land tenure, ownership signage, or boundary markers.",
        "required": False,
    },
    {
        "id": "overlapping_disputed_claims",
        "label": "Overlapping or disputed land claims",
        "subcategory": "Disputes & Claims",
        "section_id": "tenure_governance",
        "section_title": "Tenure & Governance",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "Clear Uncontested Boundaries",
            "Active Boundary Dispute / Competing Signage",
            "Inconclusive / Requires Investigation",
            "Unknown / Unable to verify",
        ],
        "metric": "Conflicting boundary markers, rival fencing, or contested possession",
        "help_text": "Note physical signs of boundary friction, multiple claimant markings, or local dispute notices.",
        "required": False,
    },
    {
        "id": "local_governance_authority",
        "label": "Local governance and identifiable authority",
        "subcategory": "Local Governance",
        "section_id": "tenure_governance",
        "section_title": "Tenure & Governance",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "Recognized Local / Municipal Authority Present",
            "Traditional / Community Council Administration",
            "Informal Governance / No Verifiable Authority",
            "Unknown / Unable to verify",
        ],
        "metric": "Presence of active council office, chieftaincy, or municipal jurisdiction",
        "help_text": "Verify whether an identifiable governing entity actively administers the site.",
        "required": False,
    },
    {
        "id": "community_partnership_opportunity",
        "label": "Community partnership opportunities",
        "subcategory": "Community Opportunities",
        "section_id": "tenure_governance",
        "section_title": "Tenure & Governance",
        "factor_type": "Opportunity",
        "type": "select",
        "options": [
            "High Engagement / Receptive Local Stakeholders",
            "Moderate Interest / Conditional Engagement",
            "No Engagement Identified / Community Resistance",
            "Unknown / Unable to verify",
        ],
        "metric": "Community receptiveness to co-management, stewardship, or project engagement",
        "help_text": "Assess local stakeholder openness to co-management, community benefits, or stewardship.",
        "required": False,
    },

    # --- Category 2: Environmental & Climatic ---
    {
        "id": "observed_flood_risk",
        "label": "Flood risk and observed flooding",
        "subcategory": "Flood Hazards",
        "section_id": "environmental_climatic",
        "section_title": "Environmental & Climatic",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "No Flood Signs / Well Drained",
            "Seasonal Pooling / Surface Runoff Signs",
            "Severe Inundation / Active Floodplain",
            "Unknown / Unable to verify",
        ],
        "metric": "Standing water, high-water drift marks, or seasonal ponding indicators",
        "help_text": "Inspect the site for physical evidence of high-water marks, seasonal ponding, or waterlogged soil.",
        "required": False,
    },
    {
        "id": "drought_water_stress",
        "label": "Drought and water stress",
        "subcategory": "Water Stress",
        "section_id": "environmental_climatic",
        "section_title": "Environmental & Climatic",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "Adequate Water Access / Normal Hydrology",
            "Seasonal Water Scarcity / Reduced Availability",
            "Severe Drought / Dried Water Sources",
            "Unknown / Unable to verify",
        ],
        "metric": "Visible desiccated vegetation, cracked soil, or depleted water tables",
        "help_text": "Observe local water source condition, vegetation stress, and drying indicators.",
        "required": False,
    },
    {
        "id": "protected_sensitive_habitat",
        "label": "Protected areas and sensitive habitat",
        "subcategory": "Sensitive Habitats",
        "section_id": "environmental_climatic",
        "section_title": "Environmental & Climatic",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "No Sensitive Habitat / Fully Modified Area",
            "Adjacent to Ecological Buffer Zone",
            "Encroaching on Protected / Wetland Habitat",
            "Unknown / Unable to verify",
        ],
        "metric": "Proximity to designated nature reserve, wetland buffer, or wildlife corridor",
        "help_text": "Determine if the site borders or encroaches upon sensitive natural habitats.",
        "required": False,
    },

    # --- Category 3: Development Suitability ---
    {
        "id": "previous_land_use",
        "label": "Previous industrial, mining, or intensive agricultural land use",
        "subcategory": "Historical Land Use",
        "section_id": "development_suitability",
        "section_title": "Development Suitability",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "Clean Greenfield / Undisturbed Site",
            "Past Monoculture / Minor Soil Disturbance",
            "Prior Industrial / Mining / Contamination Signs",
            "Unknown / Unable to verify",
        ],
        "metric": "Detected prior intensive chemical, scrap, mining, or extractive usage",
        "help_text": "Observe ground for slag, chemical waste, spoil heaps, or former industrial debris.",
        "required": False,
    },
    {
        "id": "terrain_slope",
        "label": "Terrain and slope",
        "subcategory": "Terrain & Topography",
        "section_id": "development_suitability",
        "section_title": "Development Suitability",
        "factor_type": "Opportunity",
        "type": "select",
        "options": [
            "Flat Ground (<5° slope, buildable)",
            "Moderate Slope (5°-15° slope)",
            "Steep Slope (>15° slope, erosion risk)",
            "Unknown / Unable to verify",
        ],
        "metric": "Estimated ground inclination and topographical stability",
        "help_text": "Classify observable terrain grade, slope steepness, and earthwork feasibility.",
        "required": False,
    },
    {
        "id": "development_zoning_constraints",
        "label": "Development, zoning, and land-use constraints",
        "subcategory": "Zoning & Access",
        "section_id": "development_suitability",
        "section_title": "Development Suitability",
        "factor_type": "Risk",
        "type": "select",
        "options": [
            "No Constraints / Unencumbered Site",
            "Minor Physical Servitude / Utility Easement",
            "Significant Encroachment / Access Barrier",
            "Unknown / Unable to verify",
        ],
        "metric": "Observable utility corridors, right-of-way servitudes, or unapproved structures",
        "help_text": "Record observable easements, power line corridors, or physical impediments.",
        "required": False,
    },
]


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", text.strip()).lower().strip("_")
    return s[:64]


def get_all_factors() -> List[Dict[str, Any]]:
    """Authoritative reference factor list for backwards compatibility and data reporting."""
    factors = []
    for item in FACTORS_RAW:
        f_id = f"factor_{_slugify(item['factor'])}"
        is_risk = item["type"] == "Risk"
        factors.append({
            "id": f_id,
            "section_id": item["section_id"],
            "section_title": next((s["title"] for s in FACTOR_SECTIONS if s["id"] == item["section_id"]), item["section_id"]),
            "factor": item["factor"],
            "factor_type": item["type"],
            "source": item["source"],
            "scoring_method": item["scoring_method"],
            "metric": item["metric"],
            "relevance": item["relevance"],
            "label": item["factor"],
            "type": "select",
            "options": RISK_OPTIONS if is_risk else OPPORTUNITY_OPTIONS,
            "required": False,
            "placeholder": f"Select observed {item['type'].lower()} status",
        })
    return factors


def is_factor_relevant_to_project_type(factor_relevance: str, project_type: str) -> bool:
    rel_lower = factor_relevance.lower()
    pt_lower = project_type.lower()
    if "all" in rel_lower:
        return True
    keywords = {
        "Real Estate Development": ["real estate"],
        "Manufacturing and Industry": ["manufacturing", "industry"],
        "Urban Planning and Architecture": ["urban planning", "architecture"],
        "Infrastructure Finance": ["infrastructure", "finance"],
        "Energy Development": ["energy"],
        "Agriculture": ["agriculture", "ag"],
        "Community & Advocacy": ["community", "advocacy", "conservation"],
    }
    target_kws = keywords.get(project_type, [pt_lower])
    return any(kw in rel_lower for kw in target_kws)


def compile_task_form_schema(
    task_id: str,
    project_type: Optional[str] = None,
    selected_factor_ids: Optional[List[str]] = None,
    instructions: Optional[str] = None,
    version: int = 1,
) -> Dict[str, Any]:
    """Compile simplified, conditional field survey schema (max 10 questions).
    
    Adheres strictly to Loupe's Risk & Opportunity Matrix:
    - Excludes the 6 yellow-highlighted factors already measured by automated processes.
    - Excludes backend GIS / remote-sensing computations.
    - Limits contributor questions to a maximum of 10 relevant observations.
    - Organizes questions into the 3 hierarchical categories (Tenure, Environmental, Development).
    - Preserves backward compatibility mappings for existing verified workflows.
    """
    resolved_pt = project_type or "Real Estate Development"
    if resolved_pt not in PROJECT_TYPES:
        match = next((k for k in PROJECT_TYPES if k.lower() == resolved_pt.lower()), None)
        resolved_pt = match or "Real Estate Development"

    pt_info = PROJECT_TYPES[resolved_pt]
    is_water_task = resolved_pt in ("water_source", "Community & Advocacy") or "water" in str(project_type).lower()
    is_solar_task = resolved_pt in ("solar_installation", "solar_canopy", "renewable_energy", "Energy Development") or "solar" in str(project_type).lower()

    fields: List[Dict[str, Any]] = []

    # -----------------------------------------------------------------------
    # Build the Survey Questions (Maximum 10 Questions)
    # -----------------------------------------------------------------------
    if is_water_task:
        # SURVEY 1: Community Water Source / Environmental Resource Survey
        # Purpose: Evaluate water point condition, tenure security, flood/drought risk, and ecological buffers
        fields = [
            # 1. Operational Status (Backward-compatible with test_submissions)
            {
                "id": "operational_status",
                "label": "Water Point Operational Status",
                "subcategory": "Functionality & Condition",
                "section_id": "development_suitability",
                "section_title": "Development Suitability",
                "factor_type": "Risk",
                "type": "select",
                "options": ["operational", "partially_functional", "broken", "dry", "Unknown / Unable to verify"],
                "metric": "Physical pumping mechanism and water flow operation",
                "help_text": "Verify whether the pump mechanism is functional and providing water.",
                "required": True,
            },
            # 2. Water Clarity (Backward-compatible with test_submissions)
            {
                "id": "water_clarity",
                "label": "Water Clarity & Perceived Quality",
                "subcategory": "Water Quality",
                "section_id": "environmental_climatic",
                "section_title": "Environmental & Climatic",
                "factor_type": "Risk",
                "type": "select",
                "options": ["clear", "moderate_turbidity", "cloudy", "discolored", "Unknown / Unable to verify"],
                "metric": "Visual clarity and turbidity inspection of pumped water",
                "help_text": "Inspect the visual clarity of water discharging from the source.",
                "required": True,
            },
            # 3. Land ownership & title status
            {
                "id": "land_ownership_status",
                "label": "Land Ownership & Water Rights Status",
                "subcategory": "Ownership & Registration",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Communal / Public Water Point", "Private Land Access", "Informal Customary Access", "Unknown / Unable to verify"],
                "metric": "Public water reservation, communal title, or private easement",
                "help_text": "Record tenure status and public right-of-way to the water source.",
                "required": False,
            },
            # 4. Overlapping or disputed claims
            {
                "id": "overlapping_disputed_claims",
                "label": "Overlapping or Disputed Land Claims",
                "subcategory": "Disputes & Claims",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Risk",
                "type": "select",
                "options": ["No Known Dispute / Peaceful Access", "Active Contested Access Rights", "Boundary Dispute Affecting Water Point", "Unknown / Unable to verify"],
                "metric": "Competing user claims or contested perimeter boundary",
                "help_text": "Check for active disputes between communities or landholders.",
                "required": False,
            },
            # 5. Local governance authority
            {
                "id": "local_governance_authority",
                "label": "Local Water Committee or Authority",
                "subcategory": "Local Governance",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Active Water Committee Present", "Traditional Council Oversight", "No Identifiable Water Governance", "Unknown / Unable to verify"],
                "metric": "Presence of active community caretaker or water board",
                "help_text": "Verify if an organized community group manages water distribution.",
                "required": False,
            },
            # 6. Community partnership opportunities
            {
                "id": "community_partnership_opportunity",
                "label": "Community Co-Management Potential",
                "subcategory": "Community Opportunities",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Opportunity",
                "type": "select",
                "options": ["High Willingness for Maintenance Partnership", "Moderate Interest / Conditional", "No Engagement / Disrepair", "Unknown / Unable to verify"],
                "metric": "Local willingness to participate in water steward partnerships",
                "help_text": "Assess community readiness to co-fund or maintain source.",
                "required": False,
            },
            # 7. Flood risk and observed flooding
            {
                "id": "observed_flood_risk",
                "label": "Flood Hazards & Apron Drainage",
                "subcategory": "Flood Hazards",
                "section_id": "environmental_climatic",
                "section_title": "Environmental & Climatic",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Well Drained / Apron Intact", "Stagnant Water / Clogged Drainage Soakaway", "Severe Flood Inundation Zone", "Unknown / Unable to verify"],
                "metric": "Concrete apron condition, drainage soakaway clearance, flood marks",
                "help_text": "Inspect drainage channel to prevent contaminated surface runoff ingress.",
                "required": False,
            },
            # 8. Drought and water stress
            {
                "id": "drought_water_stress",
                "label": "Seasonal Water Yield & Drought Stress",
                "subcategory": "Water Stress",
                "section_id": "environmental_climatic",
                "section_title": "Environmental & Climatic",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Perennial Reliable Yield", "Seasonal Depletion / Low Pressure", "Acute Dry Failure", "Unknown / Unable to verify"],
                "metric": "Seasonal aquifer reliability and pump yield pressure",
                "help_text": "Record whether the water point suffers seasonal dryouts.",
                "required": False,
            },
            # 9. Protected areas and sensitive habitat
            {
                "id": "protected_sensitive_habitat",
                "label": "Spring Head & Wetland Habitat Protection",
                "subcategory": "Sensitive Habitats",
                "section_id": "environmental_climatic",
                "section_title": "Environmental & Climatic",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Spring Head Protected / Fenced", "Exposed to Livestock Intrusion", "Wetland Habitat Degraded", "Unknown / Unable to verify"],
                "metric": "Protection fencing from livestock grazing and wildlife contamination",
                "help_text": "Verify if the water source perimeter is protected from contamination.",
                "required": False,
            },
            # 10. Prior industrial or agricultural contamination
            {
                "id": "previous_land_use",
                "label": "Agricultural Runoff or Contamination Risk",
                "subcategory": "Historical Land Use",
                "section_id": "development_suitability",
                "section_title": "Development Suitability",
                "factor_type": "Risk",
                "type": "select",
                "options": ["No Nearby Contamination Sources", "Upstream Intensive Agriculture / Pesticides", "Nearby Latrines / Sewage Runoff (<30m)", "Unknown / Unable to verify"],
                "metric": "Proximity to pit latrines, animal kraals, or agrochemical spray zones",
                "help_text": "Note any potential contamination sources within 30 meters.",
                "required": False,
            },
        ]
    elif is_solar_task:
        # SURVEY 2: Solar Mini-Grid / Renewable Energy Survey
        # Purpose: Assess photovoltaic hardware, shading, terrain, tenure, and hazards
        fields = [
            # 1. Panel Physical Integrity (Backward-compatible with test_validation & demo_phase3)
            {
                "id": "panel_condition",
                "label": "Panel Physical Integrity",
                "subcategory": "Hardware Integrity",
                "section_id": "development_suitability",
                "section_title": "Development Suitability",
                "factor_type": "Risk",
                "type": "select",
                "options": ["intact", "microcracks", "heavy_soiling", "shattered", "Unknown / Unable to verify"],
                "metric": "Visual glass integrity, solar cell microcracks, or panel delamination",
                "help_text": "Inspect photovoltaic panel array for cracks, hotspots, or soiling.",
                "required": True,
            },
            # 2. Canopy Shading (Backward-compatible with test_validation & demo_phase3)
            {
                "id": "shading_obstructions",
                "label": "Canopy Shading & Obstructions",
                "subcategory": "Solar Exposure",
                "section_id": "environmental_climatic",
                "section_title": "Environmental & Climatic",
                "factor_type": "Risk",
                "type": "select",
                "options": ["none", "partial_morning", "partial_afternoon", "dense_overhang", "Unknown / Unable to verify"],
                "metric": "Vegetation overhang or structural horizon shading angle",
                "help_text": "Observe if trees or buildings cast shadows on the solar array.",
                "required": True,
            },
            # 3. Land ownership and registration status
            {
                "id": "land_ownership_status",
                "label": "Installation Site Land Ownership",
                "subcategory": "Ownership & Registration",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Institutional / Utility Title", "Private Long-term Lease", "Customary Land Agreement", "Unknown / Unable to verify"],
                "metric": "Documented lease or institutional utility land right",
                "help_text": "Verify land rights supporting the renewable energy installation.",
                "required": False,
            },
            # 4. Overlapping or disputed claims
            {
                "id": "overlapping_disputed_claims",
                "label": "Site Perimeter Dispute Status",
                "subcategory": "Disputes & Claims",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Secure Uncontested Perimeter", "Boundary Encroachment Noticed", "Active Dispute with Neighbors", "Unknown / Unable to verify"],
                "metric": "Secure fence line and boundary marker clarity",
                "help_text": "Check if fencing or perimeter markers are subject to disputes.",
                "required": False,
            },
            # 5. Local governance and identifiable authority
            {
                "id": "local_governance_authority",
                "label": "Grid Operator or Local Governing Entity",
                "subcategory": "Local Governance",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Licensed Utility / Municipal Contact Present", "Community Mini-Grid Committee", "No Verifiable Administrator", "Unknown / Unable to verify"],
                "metric": "Active operational utility oversight and security presence",
                "help_text": "Verify designated caretaker or utility operational contact.",
                "required": False,
            },
            # 6. Community partnership opportunities
            {
                "id": "community_partnership_opportunity",
                "label": "Community Off-Take & Benefit Potential",
                "subcategory": "Community Opportunities",
                "section_id": "tenure_governance",
                "section_title": "Tenure & Governance",
                "factor_type": "Opportunity",
                "type": "select",
                "options": ["High Community Demand / Productive Use", "Moderate Domestic Electrification", "Low Community Receptiveness", "Unknown / Unable to verify"],
                "metric": "Community energy off-take, agro-processing, or water pumping links",
                "help_text": "Assess community utilization of generated clean power.",
                "required": False,
            },
            # 7. Flood risk and observed flooding
            {
                "id": "observed_flood_risk",
                "label": "Flood Hazard & Equipment Inundation Risk",
                "subcategory": "Flood Hazards",
                "section_id": "environmental_climatic",
                "section_title": "Environmental & Climatic",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Elevated Array / No Inundation Risk", "Surface Runoff Near Inverter Enclosure", "Floodwater Accumulation Threat", "Unknown / Unable to verify"],
                "metric": "Inverter/battery foundation clearance above high-water line",
                "help_text": "Verify electrical equipment is raised above possible flood levels.",
                "required": False,
            },
            # 8. Drought and dust stress
            {
                "id": "drought_water_stress",
                "label": "Dust & Arid Environmental Stress",
                "subcategory": "Water Stress",
                "section_id": "environmental_climatic",
                "section_title": "Environmental & Climatic",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Low Dust Environment", "Moderate Seasonal Dust Deposition", "Severe Aridity / High Soiling Rate", "Unknown / Unable to verify"],
                "metric": "Dust accumulation rate affecting solar irradiance absorption",
                "help_text": "Record airborne dust levels and panel cleaning requirements.",
                "required": False,
            },
            # 9. Terrain and slope
            {
                "id": "terrain_slope",
                "label": "Array Mounting Slope & Topography",
                "subcategory": "Terrain & Topography",
                "section_id": "development_suitability",
                "section_title": "Development Suitability",
                "factor_type": "Opportunity",
                "type": "select",
                "options": ["Flat Ground / Optimal Tilt (<5°)", "Moderate Contoured Slope (5°-15°)", "Steep / Unstable Slope (>15°)", "Unknown / Unable to verify"],
                "metric": "Mounting rack stability and slope grade",
                "help_text": "Assess whether ground topography supports mounting rack stability.",
                "required": False,
            },
            # 10. Development, zoning, and land-use constraints
            {
                "id": "development_zoning_constraints",
                "label": "Safety Clearance & Perimeter Constraints",
                "subcategory": "Zoning & Access",
                "section_id": "development_suitability",
                "section_title": "Development Suitability",
                "factor_type": "Risk",
                "type": "select",
                "options": ["Intact Safety Perimeter / Clear Access", "Partial Fence Damage / Cattle Intrusion Risk", "Encroachment Within Buffer Zone", "Unknown / Unable to verify"],
                "metric": "Perimeter security fence integrity and clearance corridor",
                "help_text": "Verify security perimeter prevents hazardous contact with live equipment.",
                "required": False,
            },
        ]
    else:
        # GENERAL SITE SUITABILITY FIELD SURVEY (Max 10 questions)
        # Tailored for Real Estate, Infrastructure, Agriculture, or Manufacturing
        fields = list(STREAMLINED_FIELD_QUESTIONS)

    # Optional narrative observations note
    fields.append({
        "id": "field_assessment_notes",
        "label": "Site Assessment Findings & Notes Summary",
        "subcategory": "Observations Summary",
        "type": "textarea",
        "required": False,
        "placeholder": "Record ground-truth site observations, land tenure interviews, and document references...",
        "section_id": "development_suitability",
        "section_title": "Development Suitability",
        "help_text": "Detailed physical notes corresponding to attached evidence documents, links, and photographs.",
    })

    default_instructions = (
        f"Inspect parcel according to '{resolved_pt}' field criteria. "
        "Complete the simplified 10-question survey across Tenure & Governance, Environmental & Climatic, and Development Suitability. "
        "Upload photos, documents, and provide registry/GIS links if available."
    )

    return {
        "task_id": task_id,
        "version": version,
        "project_type": resolved_pt,
        "project_type_description": pt_info["description"],
        "user_profile": pt_info["user_profile"],
        "instructions": instructions or default_instructions,
        "sections": FACTOR_SECTIONS,
        "fields": fields,
        "minimum_photos": 1,
        "minimum_files": 1,
        "evidence_requirements": {
            "allow_files": True,
            "allow_links": True,
            "allowed_file_types": [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/heic",
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "text/plain",
                "text/csv",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
            "allowed_extensions": [
                ".jpg", ".jpeg", ".png", ".webp", ".heic",
                ".pdf", ".doc", ".docx", ".txt", ".csv", ".xls", ".xlsx"
            ],
            "min_files": 1,
            "max_files": 50,
            "max_file_size_bytes": 52428800,  # 50 MB
        },
    }

