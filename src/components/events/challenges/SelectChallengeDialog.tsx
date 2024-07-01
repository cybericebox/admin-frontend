import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import SelectChallengesForm from "@/components/events/challenges/SelectChallengeForm";

interface SelectChallengesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    order: number;
    categoryID: string;
    eventID: string;
}

export default function SelectChallengesDialog({
                                                   onClose,
                                                   isOpen,
                                                   eventID,
                                                   categoryID
                                               }: SelectChallengesDialogProps) {

    return (
        <Dialog open={isOpen} onOpenChange={onClose} modal={true} defaultOpen={false}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className={"text-2xl text-primary"}></DialogTitle>
                    <DialogDescription
                        className={"h-full w-full"}
                    >
                        <SelectChallengesForm eventID={eventID} categoryID={categoryID} onCancel={onClose}/>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}