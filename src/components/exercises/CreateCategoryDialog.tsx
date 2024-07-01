import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import ExerciseCategoryForm from "@/components/exercises/CategoryForm";

export interface CreateCategoryDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateCategoryDialog({onClose, isOpen}: CreateCategoryDialogProps) {

    return (
        <Dialog open={isOpen} onOpenChange={onClose} modal={true} defaultOpen={false}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className={"text-2xl text-primary"}></DialogTitle>
                    <DialogDescription>
                        <ExerciseCategoryForm type={"Створити"} onCancel={onClose}/>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}