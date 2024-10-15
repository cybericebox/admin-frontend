"use client"
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEventChallengeCategory} from "@/hooks/useEventChallengeCategory";
import {DragDropContext, Droppable, DropResult} from "@hello-pangea/dnd"
import {Button} from "@/components/ui/button";
import React from "react";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import {Tooltip} from "react-tooltip";
import {IOrder} from "@/types/challenge";
import ChallengeCategoryCard from "@/components/events/challenges/ChallengeCategoryCard";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";

interface EventChallengesCardProps {
    eventID: string
}

export default function EventChallengesCard({eventID}: EventChallengesCardProps) {
    const {GetEventChallengeCategoriesResponse} = useEventChallengeCategory().useGetEventChallengeCategories(eventID)
    const {GetEventChallengesResponse} = useEventChallenge().useGetEventChallenges(eventID)
    const {CreateEventChallengeCategory} = useEventChallengeCategory().useCreateEventChallengeCategory(eventID)
    const {UpdateEventChallengeCategoriesOrder} = useEventChallengeCategory().useUpdateEventChallengeCategoriesOrder(eventID)
    const {UpdateEventChallengesOrder} = useEventChallenge().useUpdateEventChallengesOrder(eventID)

    const createDefaultCategory = () => {
        // generate unique category name
        const categoryNames = GetEventChallengeCategoriesResponse?.Data.map(category => category.Name)
        let index = (categoryNames?.length || 0) + 1
        let name = `Категорія ${index}`
        while (categoryNames?.includes(name)) {
            index++
            name = `Категорія ${index}`
        }

        CreateEventChallengeCategory({
            Name: name,
            Order: (categoryNames?.length || 0),
            EventID: eventID
        }, {
            onError: (error) => {
                const e = error as IErrorResponse
                ErrorToast({message: "Не вдалося створити категорію", error: e})
            },
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

        const data: IOrder[] = [];

        // if type is category
        if (type === "category") {
            const items = reorder(GetEventChallengeCategoriesResponse?.Data!, source.index, destination.index);

            items.forEach((item, index) => {
                item.Order = index;
                data.push({ID: item.ID!, Index: index})
            });

            UpdateEventChallengeCategoriesOrder(data, {
                onError: (error) => {
                    const e = error as IErrorResponse
                    ErrorToast({message: "Не вдалося оновити порядок категорій", error: e})
                }
            });
        }

        if (type === "challenge") {
            const sourceList = GetEventChallengesResponse?.Data.filter(challenge => challenge.CategoryID === source.droppableId)
            const destinationList = GetEventChallengesResponse?.Data.filter(challenge => challenge.CategoryID === destination.droppableId)

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

                UpdateEventChallengesOrder(data, {
                    onError: (error) => {
                        const e = error as IErrorResponse
                        ErrorToast({message: "Не вдалося оновити порядок завдань", error: e})
                    }
                });

            } else {
                const [removed] = sourceList.splice(source.index, 1);


                // update category id for the moved challenge
                removed.CategoryID = destination.droppableId

                destinationList.splice(destination.index, 0, removed);

                sourceList.forEach((item, index) => {
                    item.Order = index;
                    data.push({ID: item.ID!, Index: item.Order, CategoryID: item.CategoryID})
                });

                destinationList.forEach((item, index) => {
                    item.Order = index;
                    data.push({ID: item.ID!, Index: item.Order, CategoryID: item.CategoryID})
                });

                UpdateEventChallengesOrder(data, {
                    onError: (error) => {
                        const e = error as IErrorResponse
                        ErrorToast({message: "Не вдалося оновити порядок завдань", error: e})
                    }
                });
            }
        }
    }

    return (
        <>
            <BodyHeader title={"Завдання заходу"}>
                <Button
                    className={"min-w-fit min-h-fit text-lg"}
                    type={"button"}
                    onClick={createDefaultCategory}
                >
                    Додати категорію
                </Button>
            </BodyHeader>
            <BodyContent
                className={"overflow-hidden"}
            >
                <div
                    className={"w-full h-full flex flex-col md:flex-row gap-6"}
                >
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId={"categories"} type={"category"}
                                   direction={typeof window !== "undefined" && window?.innerWidth < 768 ? "vertical" : "horizontal"}>
                            {
                                (provided) => (
                                    <div
                                        key={"categories"}
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={"flex gap-6 flex-col md:flex-row overflow-auto"}
                                    >
                                        {GetEventChallengeCategoriesResponse?.Data.map((category, index) => (
                                            <ChallengeCategoryCard category={category} index={index} key={category.ID}/>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )
                            }
                        </Droppable>
                    </DragDropContext>
                </div>
            </BodyContent>
            <Tooltip
                id={"challenge-tooltip"}
                className={"!bg-primary"}
                opacity={1}
            />
        </>
    )
}