export type ProjectStatus = 'draft' | 'published';
export type InquiryStatus = 'new' | 'review' | 'in_progress' | 'converted' | 'completed' | 'archived';
export interface Category { id: string; name: string; slug: string; sortOrder: number }
export interface Project { id: string; slug: string; title: string; summary: string; description: string; categoryId: string | null; coverMediaId: string | null; coverUrl: string; coverAlt: string; videoUrl: string; sourceUrl: string; featured: boolean; sortOrder: number; status: ProjectStatus; createdAt: string; updatedAt: string }
export type ProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'sourceUrl'> & { id?: string; sourceUrl?: string };
export type CategoryInput = Omit<Category, 'id'> & { id?: string };
export interface SiteSettings { brandName: string; headline: string; subheadline: string; about: string; email: string; instagramUrl: string; accentColor: string; servicesText: string; availability: string }
export type PublicSiteSettings = SiteSettings;
export type SettingsInput = SiteSettings;
export type InquiryPriority = 'normal' | 'urgent' | 'planning';
export interface Inquiry { id: string; name: string; email: string; service: string; brief: string; status: InquiryStatus; createdAt: string; updatedAt: string; notes?: string; priority?: InquiryPriority; deletedAt?: string | null; referenceId?: string; quoteCents?: number; dueDate?: string; checklist?: { rough: boolean; cleanup: boolean; edit: boolean; render: boolean } }
export type InquiryInput = Pick<Inquiry, 'name' | 'email' | 'service' | 'brief'>;
export interface Media { id: string; url: string; filename: string; mime: string; size: number; width: number; height: number; alt: string; createdAt: string }
