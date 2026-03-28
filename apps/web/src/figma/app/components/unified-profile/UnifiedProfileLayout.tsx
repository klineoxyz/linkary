import React from "react";
import {
  ProfileData,
  ViewMode,
  ProfileHero,
  ReputationBlock,
  QuickLinksBlock,
  RelationshipBlock,
  CaseStudyCard,
  TeamMemberCard,
  ReviewCard,
  CircleCard,
  Card,
  Button,
} from "./ProfileComponents";
import { Plus } from "lucide-react";
import WalletsSection from "./WalletsSection";

/**
 * Unified Profile Layout
 * 
 * Single scrollable page layout that adapts based on entity type
 * Supports 3 view modes: public, logged-in, editor
 * 
 * No sidebar - clean single-column scrollable page
 */

interface UnifiedProfileLayoutProps {
  data: ProfileData;
  viewMode: ViewMode;
  /** Supabase profile id (auth.users.id). When set, wallets are loaded and owner can edit. */
  profileId?: string;

  // Edit callbacks (only used in editor mode)
  onEditHero?: () => void;
  onEditLinks?: () => void;
  onAddLink?: () => void;
  onAddRelationship?: (type: string) => void;
  onRequestVerification?: (id: string) => void;
  onAddCaseStudy?: () => void;
  onInviteToCircle?: (circleId: string) => void;
}

// ============================================================================
// SECTION CONFIGURATION PER ENTITY TYPE
// ============================================================================

function getSectionsForEntityType(entityType: string, data: ProfileData) {
  const sections: { key: string; title: string; component: React.ReactNode }[] = [];
  
  // All entities get Quick Links
  if (data.links && data.links.length > 0) {
    sections.push({ key: "links", title: "Quick Links", component: null });
  }
  
  // All entities get Reputation
  sections.push({ key: "reputation", title: "Reputation", component: null });
  
  // Entity-specific sections
  switch (entityType) {
    case "individual":
      // Individual: Worked With, My Projects, Case Studies, Circles
      if (data.workedWith && data.workedWith.length > 0) {
        sections.push({ key: "workedWith", title: "Worked With", component: null });
      }
      if (data.myProjects && data.myProjects.length > 0) {
        sections.push({ key: "myProjects", title: "My Projects", component: null });
      }
      if (data.caseStudies && data.caseStudies.length > 0) {
        sections.push({ key: "caseStudies", title: "Case Studies & Portfolio", component: null });
      }
      if (data.partners && data.partners.length > 0) {
        sections.push({ key: "partners", title: "Partners", component: null });
      }
      if (data.circles && data.circles.length > 0) {
        sections.push({ key: "circles", title: "My Circles", component: null });
      }
      break;
      
    case "agency":
      // Agency: Customers, Ambassadors, Partners, Communities
      if (data.customers && data.customers.length > 0) {
        sections.push({ key: "customers", title: "Customers", component: null });
      }
      if (data.ambassadors && data.ambassadors.length > 0) {
        sections.push({ key: "ambassadors", title: "Ambassadors", component: null });
      }
      if (data.affiliates && data.affiliates.length > 0) {
        sections.push({ key: "affiliates", title: "Affiliates", component: null });
      }
      if (data.partners && data.partners.length > 0) {
        sections.push({ key: "partners", title: "Partner Projects", component: null });
      }
      if (data.caseStudies && data.caseStudies.length > 0) {
        sections.push({ key: "caseStudies", title: "Case Studies", component: null });
      }
      if (data.communities && data.communities.length > 0) {
        sections.push({ key: "communities", title: "Communities", component: null });
      }
      break;
      
    case "company":
      // Company: Team, Subsidiaries, Ecosystem, Partners, Ambassadors
      if (data.team && data.team.length > 0) {
        sections.push({ key: "team", title: "Team & Founders", component: null });
      }
      if (data.subsidiaries && data.subsidiaries.length > 0) {
        sections.push({ key: "subsidiaries", title: "Subsidiaries", component: null });
      }
      if (data.myProjects && data.myProjects.length > 0) {
        sections.push({ key: "myProjects", title: "Projects", component: null });
      }
      if (data.ecosystem && data.ecosystem.length > 0) {
        sections.push({ key: "ecosystem", title: "Ecosystem", component: null });
      }
      if (data.partners && data.partners.length > 0) {
        sections.push({ key: "partners", title: "Partners", component: null });
      }
      if (data.ambassadors && data.ambassadors.length > 0) {
        sections.push({ key: "ambassadors", title: "Ambassadors", component: null });
      }
      if (data.communities && data.communities.length > 0) {
        sections.push({ key: "communities", title: "Communities", component: null });
      }
      break;
      
    case "project":
    case "brand":
      // Project/Brand: Team, Partners, Ambassadors, Customers, Case Studies
      if (data.team && data.team.length > 0) {
        sections.push({ key: "team", title: "Team & Founders", component: null });
      }
      if (data.partners && data.partners.length > 0) {
        sections.push({ key: "partners", title: "Partners", component: null });
      }
      if (data.ambassadors && data.ambassadors.length > 0) {
        sections.push({ key: "ambassadors", title: "Ambassadors", component: null });
      }
      if (data.affiliates && data.affiliates.length > 0) {
        sections.push({ key: "affiliates", title: "Affiliates", component: null });
      }
      if (data.customers && data.customers.length > 0) {
        sections.push({ key: "customers", title: "Customers", component: null });
      }
      if (data.caseStudies && data.caseStudies.length > 0) {
        sections.push({ key: "caseStudies", title: "Case Studies", component: null });
      }
      if (data.ecosystem && data.ecosystem.length > 0) {
        sections.push({ key: "ecosystem", title: "Ecosystem", component: null });
      }
      if (data.communities && data.communities.length > 0) {
        sections.push({ key: "communities", title: "Communities", component: null });
      }
      break;
  }
  
  // All entities with reviews
  if (data.reviews && data.reviews.length > 0) {
    sections.push({ key: "reviews", title: "Reviews", component: null });
  }
  
  return sections;
}

// ============================================================================
// MAIN LAYOUT
// ============================================================================

export default function UnifiedProfileLayout({
  data,
  viewMode,
  profileId,
  onEditHero,
  onEditLinks,
  onAddLink,
  onAddRelationship,
  onRequestVerification,
  onAddCaseStudy,
  onInviteToCircle,
}: UnifiedProfileLayoutProps) {
  const isEditor = viewMode === "editor";
  
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Minimal Top Bar (optional - only for standalone pages) */}
      {viewMode === "public" && (
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl font-bold text-primary">
              <img src="/icons/linkary-icon.png" alt="" className="h-6 w-auto" aria-hidden />
              Linkary
            </div>
            <div className="text-sm text-neutral-600">linkary.xyz/{data.slug}</div>
          </div>
        </header>
      )}
      
      {/* Main Content - Single Column, Scrollable */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Hero Section */}
        <ProfileHero 
          data={data} 
          viewMode={viewMode}
          onEdit={onEditHero}
        />
        
        {/* Quick Links */}
        {data.links && data.links.length > 0 && (
          <QuickLinksBlock
            links={data.links}
            viewMode={viewMode}
            onEdit={onEditLinks}
            onAdd={onAddLink}
          />
        )}
        
        {/* Reputation Scores */}
        <ReputationBlock data={data} viewMode={viewMode} />

        {/* Wallets (manual for now; owner can add/edit when profileId matches session) */}
        <WalletsSection profileId={profileId} />
        
        {/* Entity-Specific Sections */}
        
        {/* Team & Founders */}
        {data.team && data.team.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">
                Team & Founders
              </h2>
              {isEditor && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onAddRelationship?.("team")}
                  icon={<Plus className="h-4 w-4" />}
                >
                  Add
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.team.map((member) => (
                <TeamMemberCard key={member.id} member={member} />
              ))}
            </div>
          </Card>
        )}
        
        {/* Worked With / Worked For */}
        {data.workedWith && data.workedWith.length > 0 && (
          <RelationshipBlock
            title="Worked With"
            items={data.workedWith}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("workedWith")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* My Projects */}
        {data.myProjects && data.myProjects.length > 0 && (
          <RelationshipBlock
            title={data.entityType === "individual" ? "My Projects" : "Projects"}
            items={data.myProjects}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("myProjects")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* Subsidiaries */}
        {data.subsidiaries && data.subsidiaries.length > 0 && (
          <RelationshipBlock
            title="Subsidiaries"
            items={data.subsidiaries}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("subsidiaries")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* Ecosystem */}
        {data.ecosystem && data.ecosystem.length > 0 && (
          <RelationshipBlock
            title="Ecosystem"
            items={data.ecosystem}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("ecosystem")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* Partners */}
        {data.partners && data.partners.length > 0 && (
          <RelationshipBlock
            title="Partners"
            items={data.partners}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("partners")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* Ambassadors */}
        {data.ambassadors && data.ambassadors.length > 0 && (
          <RelationshipBlock
            title="Ambassadors"
            items={data.ambassadors}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("ambassadors")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* Affiliates */}
        {data.affiliates && data.affiliates.length > 0 && (
          <RelationshipBlock
            title="Affiliates"
            items={data.affiliates}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("affiliates")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* Customers */}
        {data.customers && data.customers.length > 0 && (
          <RelationshipBlock
            title="Customers"
            items={data.customers}
            viewMode={viewMode}
            onAdd={() => onAddRelationship?.("customers")}
            onRequestVerification={onRequestVerification}
          />
        )}
        
        {/* Case Studies */}
        {data.caseStudies && data.caseStudies.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">
                Case Studies & Portfolio
              </h2>
              {isEditor && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onAddCaseStudy}
                  icon={<Plus className="h-4 w-4" />}
                >
                  Add
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {data.caseStudies.map((study) => (
                <CaseStudyCard key={study.id} study={study} />
              ))}
            </div>
          </div>
        )}
        
        {/* Circles */}
        {data.circles && data.circles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">
                My Circles
              </h2>
              {isEditor && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                >
                  Create Circle
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.circles.map((circle) => (
                <CircleCard 
                  key={circle.id} 
                  circle={circle}
                  onInvite={onInviteToCircle}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Reviews */}
        {data.reviews && data.reviews.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">
                Reviews
              </h2>
              {viewMode !== "public" && (
                <Button variant="secondary" size="sm">
                  Leave Review
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {data.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <footer className="pt-8 pb-4 text-center">
          <p className="text-sm text-neutral-500">
            © 2026 Linkary · linkary.xyz/{data.slug}
          </p>
        </footer>
      </main>
    </div>
  );
}
