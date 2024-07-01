import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";

export interface DeleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    name: string;
    description: string;
    onDelete: () => void;

}

export default function DeleteDialog({onDelete, onClose, isOpen, name, description}: DeleteDialogProps) {

    const userDelete = async () => {
        onDelete()
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose} modal={true} defaultOpen={false}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className={"text-2xl text-primary"}>Видалити {name}?</DialogTitle>
                    <DialogDescription className={"text-lg"}>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={onClose} variant={'secondary'}>Відмінити</Button>
                    <Button onClick={userDelete} variant={"destructive"}>Видалити</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}