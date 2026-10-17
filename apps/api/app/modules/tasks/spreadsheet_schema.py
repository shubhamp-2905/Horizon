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


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", text.strip()).lower().strip("_")
    return s[:64]


def get_all_factors() -> List[Dict[str, Any]]:
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
            "required": True,
            "placeholder": f"Select observed {item['type'].lower()} status",
        })
    return factors


def is_factor_relevant_to_project_type(factor_relevance: str, project_type: str) -> bool:
    rel_lower = factor_relevance.lower()
    pt_lower = project_type.lower()
    
    if "all" in rel_lower:
        return True
    
    # Project-type keyword mapping
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
    """Compile declarative spreadsheet-driven form schema for a task.
    Preserves exact spreadsheet labels, factor metrics, and scoring methods.
    """
    resolved_pt = project_type or "Real Estate Development"
    if resolved_pt not in PROJECT_TYPES:
        # Match case-insensitively or fallback
        match = next((k for k in PROJECT_TYPES if k.lower() == resolved_pt.lower()), None)
        resolved_pt = match or "Real Estate Development"

    pt_info = PROJECT_TYPES[resolved_pt]
    all_factors = get_all_factors()

    if selected_factor_ids:
        active_factors = [f for f in all_factors if f["id"] in selected_factor_ids]
        if not active_factors:
            active_factors = all_factors
    else:
        # Prioritize factors relevant to this project type
        active_factors = all_factors

    fields = []
    # 1. Project Type Confirmation Header / Readonly Indicator
    fields.append({
        "id": "project_type_selection",
        "label": "Project Type",
        "type": "select",
        "options": list(PROJECT_TYPES.keys()),
        "required": True,
        "placeholder": resolved_pt,
        "default": resolved_pt,
        "section_id": "tenure_governance",
        "help_text": pt_info["description"],
    })

    # 2. Add spreadsheet factor fields
    for f in active_factors:
        fields.append({
            "id": f["id"],
            "label": f["label"],
            "type": f["type"],
            "options": f["options"],
            "required": True,
            "placeholder": f["placeholder"],
            "section_id": f["section_id"],
            "section_title": f["section_title"],
            "factor_type": f["factor_type"],
            "source": f["source"],
            "scoring_method": f["scoring_method"],
            "metric": f["metric"],
            "relevance": f["relevance"],
            "help_text": f"Metric: {f['metric']} | Source: {f['source']}",
        })

    # 3. Overall Field Synthesis & Narrative Observations Note
    fields.append({
        "id": "field_assessment_notes",
        "label": "Site Assessment Findings & Evidence Summary",
        "type": "textarea",
        "required": False,
        "placeholder": "Record ground-truth site observations, land tenure interviews, and document references...",
        "section_id": "development_suitability",
        "help_text": "Detailed physical notes corresponding to attached evidence documents, links, and photographs.",
    })

    default_instructions = (
        f"Inspect parcel according to '{resolved_pt}' criteria. "
        "Assess Tenure & Governance, Environmental & Climatic, and Development Suitability factors. "
        "Upload supporting documents (cadastre, permits, reports, photos) and provide official registry/GIS links."
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
