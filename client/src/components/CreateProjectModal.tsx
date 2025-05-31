import { useState } from "react";
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
import { dispatchProjectEvent, PROJECT_EVENTS } from "../utils/projectEvents";

interface CreateProjectModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCreateProject: (projectData: {
    name: string;
    description: string;
  }) => void;
}

export default function CreateProjectModal({ 
  isOpen, 
  onOpenChange, 
  onCreateProject 
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    try {
      const response = await fetch('http://localhost:8000/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create project');
      }

      const newProject = await response.json();
      
      onCreateProject({
        name: newProject.name,
        description: newProject.description || ''
      });
      
      // Dispatch project created event
      dispatchProjectEvent(PROJECT_EVENTS.PROJECT_CREATED, { project: newProject });

      // Reset form
      setName("");
      setDescription("");
      
      // Close modal
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating project:', error);
      // You might want to show an error toast here
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create project: ${errorMessage}`);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      backdrop="blur"
      classNames={{
        backdrop: "bg-gradient-to-t from-zinc-900/50 to-zinc-900/30",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Создание нового проекта</ModalHeader>
            <ModalBody>
              <Input
                autoFocus
                label="Название"
                placeholder="Введите название проекта"
                variant="bordered"
                value={name}
                onChange={(e) => setName(e.target.value)}
                isRequired
              />
              <Textarea
                label="Описание"
                placeholder="Введите описание проекта"
                variant="bordered"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Отмена
              </Button>
              <Button color="primary" onPress={handleSubmit} isDisabled={!name.trim()}>
                Создать
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
