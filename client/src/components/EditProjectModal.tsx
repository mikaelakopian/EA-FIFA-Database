import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState, useEffect } from "react";
import { dispatchProjectEvent, PROJECT_EVENTS } from "../utils/projectEvents";

interface EditProjectModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    name: string;
    description?: string;
  } | null;
}

export default function EditProjectModal({
  isOpen,
  onOpenChange,
  project
}: EditProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Reset form when project changes or modal opens
  useEffect(() => {
    if (project && isOpen) {
      setName(project.name);
      setDescription(project.description || "");
      setErrors({});
    }
  }, [project, isOpen]);

  const validateForm = () => {
    const newErrors: { name?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = "Project name is required";
    } else if (name.trim().length > 100) {
      newErrors.name = "Project name must be less than 100 characters";
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(name.trim())) {
      newErrors.name = "Project name can only contain letters, numbers, spaces, hyphens, and underscores";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !project) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`http://localhost:8000/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update project');
      }
      
      const updatedProject = await response.json();
      
      // Dispatch project updated event
      dispatchProjectEvent(PROJECT_EVENTS.PROJECT_UPDATED, updatedProject);
      
      // Close modal
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      size="md"
      placement="center"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:edit-2" className="text-primary h-5 w-5" />
                <span>Edit Project</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <Input
                  label="Project Name"
                  placeholder="Enter project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  variant="bordered"
                  isRequired
                  isInvalid={!!errors.name}
                  errorMessage={errors.name}
                  maxLength={100}
                  startContent={
                    <Icon icon="lucide:folder" className="text-default-400 h-4 w-4" />
                  }
                />
                <Textarea
                  label="Description"
                  placeholder="Enter project description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  variant="bordered"
                  maxLength={500}
                  minRows={3}
                  maxRows={5}
                  startContent={
                    <Icon icon="lucide:file-text" className="text-default-400 h-4 w-4 mt-2" />
                  }
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button 
                color="default" 
                variant="light" 
                onPress={onClose}
                isDisabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                color="primary" 
                onPress={handleSubmit}
                isLoading={isSubmitting}
                isDisabled={!name.trim() || !!errors.name}
                startContent={!isSubmitting && <Icon icon="lucide:save" className="h-4 w-4" />}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}