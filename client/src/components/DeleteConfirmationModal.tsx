import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onOpenChange,
  projectName,
  onConfirm,
  isDeleting = false
}: DeleteConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      size="sm"
      placement="center"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:alert-triangle" className="text-danger h-5 w-5" />
                <span>Delete Project</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-default-600">
                Are you sure you want to delete <strong className="text-default-800">{projectName}</strong>?
              </p>
              <p className="text-small text-danger mt-2">
                This action cannot be undone. All project data will be permanently deleted.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button 
                color="default" 
                variant="light" 
                onPress={onClose}
                isDisabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                color="danger" 
                onPress={handleConfirm}
                isLoading={isDeleting}
                startContent={!isDeleting && <Icon icon="lucide:trash-2" className="h-4 w-4" />}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}