"use client"
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEventChallengeCategory} from "@/hooks/useEventChallengeCategory";
import {DragDropContext, Droppable, DropResult} from "@hello-pangea/dnd"
import {Button} from "@/components/ui/button";
import type React from "react";
import type {Order} from "@/types/challenge";
import ChallengeCategoryCard from "@/components/events/challenges/ChallengeCategoryCard";
import {useEventChallenge} from "@/hooks/useEventChallenge";

interface EventChallengesCardProps {
    eventID: string
}

export default function EventChallengesCard({eventID}: EventChallengesCardProps) {
    const getChallengeCategories = useEventChallengeCategory().useGetEventChallengeCategories(eventID)
    const getChallenges = useEventChallenge().useGetEventChallenges(eventID)
    const createCategory = useEventChallengeCategory().useCreateEventChallengeCategory(eventID)
    const updateCategoriesOrder = useEventChallengeCategory().useUpdateEventChallengeCategoriesOrder(eventID)
    const updateChallengesOrder = useEventChallenge().useUpdateEventChallengesOrder(eventID)

    const createDefaultCategory = () => {
        createCategory.mutate({
            Name: `Категорія ${(getChallengeCategories.data?.length || 0) + 1}`,
            Order: getChallengeCategories.data?.length || 0,
            EventID: eventID
        })
    }

    function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    }

    const onDragEnd = (result: DropResult) => {
        const {source, destination, type} = result;
        if (!destination) {
            return;
        }

        // if destination is the same as source
        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return;
        }

        const data: Order[] = [];

        // if type is category
        if (type === "category") {
            const items = reorder(getChallengeCategories.data!, source.index, destination.index);


            items.forEach((item, index) => {
                item.Order = index;
                data.push({ID: item.ID!, Index: index})
            });

            updateCategoriesOrder.mutate({
                Order: data
            });
        }

        if (type === "challenge") {
            const sourceList = getChallenges.data?.filter(challenge => challenge.CategoryID === source.droppableId)
            const destinationList = getChallenges.data?.filter(challenge => challenge.CategoryID === destination.droppableId)

            if (!sourceList || !destinationList) {
                return
            }

            // if source and destination are the same
            if (source.droppableId === destination.droppableId) {
                const items = reorder(sourceList, source.index, destination.index);

                items.forEach((item, index) => {
                    item.Order = index;
                    data.push({ID: item.ID!, Index: index, CategoryID: item.CategoryID})
                });

                updateChallengesOrder.mutate({
                    Order: data
                });

            } else {

                const [removed] = sourceList.splice(source.index, 1);
                destinationList.splice(destination.index, 0, removed);

                // update category id for the moved challenge
                removed.CategoryID = destination.droppableId

                sourceList.forEach((item, index) => {
                    item.Order = index;
                    data.push({ID: item.ID!, Index: item.Order, CategoryID: item.CategoryID})
                });

                destinationList.forEach((item, index) => {
                    item.Order = index;
                    data.push({ID: item.ID!, Index: item.Order, CategoryID: item.CategoryID})
                });

                updateChallengesOrder.mutate({
                    Order: data
                });
            }
        }
    }

    return (
        <>
            <BodyHeader title={"Завдання заходу"}/>
            <BodyContent>
                <div
                    className={"h-full w-full overflow-hidden"}
                >
                    <div
                        className={"h-full w-full"}
                    >
                        <div
                            className={"w-full h-full"}
                        >
                            <div
                                className={"min-w-fit w-full flex gap-6 px-0.5"}
                            >
                                <DragDropContext onDragEnd={onDragEnd}>
                                    <Droppable droppableId={"categories"} type={"category"} direction={"horizontal"}>
                                        {
                                            (provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={"flex gap-6"}
                                                >
                                                    {getChallengeCategories.data?.map((category, index) => {
                                                        return (
                                                            <ChallengeCategoryCard category={category}
                                                                                   index={index}
                                                                                   key={category.ID!}/>
                                                        )
                                                    })}
                                                    {provided.placeholder}
                                                </div>
                                            )
                                        }


                                    </Droppable>
                                </DragDropContext>
                                <Button
                                    className={"min-w-fit text-lg"}
                                    type={"button"}
                                    onClick={createDefaultCategory}
                                >
                                    Додати категорію
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </BodyContent>
        </>
    )
}