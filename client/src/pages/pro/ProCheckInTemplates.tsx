import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  FileText, 
  Clock, 
  Users,
  ChevronRight,
  Calendar,
  Edit,
  MoreVertical,
  Archive,
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  useProCheckInTemplates, 
  useProCheckInAssignments,
  useUpdateCheckInTemplate,
  useDeleteCheckInTemplate,
  type CheckInTemplate 
} from "@/lib/pro-checkins";
import AssignCheckInTemplateModal from "@/components/AssignCheckInTemplateModal";

export default function ProCheckInTemplates() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: templates, isLoading: templatesLoading } = useProCheckInTemplates();
  const { data: assignments } = useProCheckInAssignments();
  const updateTemplate = useUpdateCheckInTemplate();
  const deleteTemplate = useDeleteCheckInTemplate();
  
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CheckInTemplate | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<CheckInTemplate | null>(null);

  const activeTemplates = templates?.filter(t => !t.is_archived) || [];
  const archivedTemplates = templates?.filter(t => t.is_archived) || [];

  const getAssignmentCount = (templateId: string) => {
    return assignments?.filter(a => a.template_id === templateId && a.is_active).length || 0;
  };

  const handleArchive = async (template: CheckInTemplate) => {
    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        is_archived: !template.is_archived,
      });
      toast({
        title: template.is_archived ? "Template Restored" : "Template Archived",
        description: template.is_archived 
          ? `"${template.name}" has been restored.`
          : `"${template.name}" has been archived.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update template.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      await deleteTemplate.mutateAsync(templateToDelete.id);
      toast({
        title: "Template Deleted",
        description: `"${templateToDelete.name}" has been permanently deleted.`,
      });
      setShowDeleteDialog(false);
      setTemplateToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template.",
        variant: "destructive",
      });
    }
  };

  const handleAssignClick = (template: CheckInTemplate) => {
    setSelectedTemplate(template);
    setShowAssignModal(true);
  };

  const renderTemplateCard = (template: CheckInTemplate) => {
    const assignmentCount = getAssignmentCount(template.id);
    
    return (
      <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{template.name}</CardTitle>
              {template.description && (
                <CardDescription className="line-clamp-2 mt-1">
                  {template.description}
                </CardDescription>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-template-menu-${template.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/pro/check-ins/templates/${template.id}`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleArchive(template)}>
                  <Archive className="h-4 w-4 mr-2" />
                  {template.is_archived ? "Restore" : "Archive"}
                </DropdownMenuItem>
                {template.is_archived && (
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => {
                      setTemplateToDelete(template);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Permanently
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {template.cadence === 'weekly' ? 'Weekly' : 'Bi-weekly'}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {template.questions_count || 0} questions
            </Badge>
            {assignmentCount > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {assignmentCount} {assignmentCount === 1 ? 'client' : 'clients'}
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => navigate(`/pro/check-ins/templates/${template.id}`)}
              data-testid={`button-edit-template-${template.id}`}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {!template.is_archived && (
              <Button 
                size="sm" 
                className="flex-1"
                onClick={() => handleAssignClick(template)}
                data-testid={`button-assign-template-${template.id}`}
              >
                <Users className="h-4 w-4 mr-2" />
                Assign
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (templatesLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Check-In Templates</h1>
          <p className="text-muted-foreground">
            Create and manage check-in templates for your clients
          </p>
        </div>
        <Button onClick={() => navigate('/pro/check-ins/templates/new')} data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {activeTemplates.length === 0 && archivedTemplates.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No templates yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first check-in template to start collecting client updates
              </p>
            </div>
            <Button onClick={() => navigate('/pro/check-ins/templates/new')} data-testid="button-create-first-template">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {activeTemplates.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Active Templates</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activeTemplates.map(renderTemplateCard)}
              </div>
            </div>
          )}

          {archivedTemplates.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">Archived Templates</h2>
              <div className="grid gap-4 md:grid-cols-2 opacity-75">
                {archivedTemplates.map(renderTemplateCard)}
              </div>
            </div>
          )}
        </>
      )}

      {selectedTemplate && (
        <AssignCheckInTemplateModal
          open={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{templateToDelete?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
