
import Graph from "https://cdn.jsdelivr.net/npm/graph-data-structure@3.3.0/+esm";
import { GROUP_TYPE, getGroupFromName } from "./group-utils.js";
import { getReferencedGroupNamesFromDataText } from "./reference-matching.js";

// edge in this graph means ' is used by -> '
// this is a reverse reference graph
// pointing to groups depending on a given group

let PRiVATE_IS_USED_BY_GRAPH = Graph();

const referencesGraph = {
    get IS_USED_BY_GRAPH() {
        return PRiVATE_IS_USED_BY_GRAPH;
    },
    set IS_USED_BY_GRAPH(graph) {
        PRiVATE_IS_USED_BY_GRAPH = graph;

        emitGraphUpdatedEvent();
    },
};

export { referencesGraph, updateReferenceGraph, buildReverseReferenceGraph }

function updateReferenceGraph(groups) {
    referencesGraph.IS_USED_BY_GRAPH = buildReverseReferenceGraph(groups);

    return referencesGraph.IS_USED_BY_GRAPH;
}

function buildReverseReferenceGraph(groups) {

    console.log("Building the invert dependency graph from the groups structure")

    // Builds the graph of 'group as a result' =>> groups that reference them to use their result
    //
    // example:
    // group 45 uses 62 and 336's results (45 references 62 and 336 in its dataText)
    // edge will be 
    // 62-> 45, 336-> 45
    //
    // that way 62 can easily find that 45 is using its result, and notify it of changes

    const graph = Graph();

    for (const [key, group] of groups) {

        if (group.type === GROUP_TYPE.BREAK) { continue; }

        graph.addNode(group.id);

        const namesOfAllGroupsReferencedByThisGroup = getReferencedGroupNamesFromDataText(group.data);

        for (const referencedGroupName of namesOfAllGroupsReferencedByThisGroup) {

            const referencedGroup = getGroupFromName(referencedGroupName, groups);

            console.log(referencedGroupName, referencedGroup)

            if (referencedGroup) {
                console.log("named reference to existing group, added to invert dependency graph", referencedGroupName, referencedGroup)

                graph.addEdge(referencedGroup.id, group.id)
            }
            else {
                console.log("named reference to unexisting group, not added to invert dependency graph", referencedGroupName)
            }
        }
    }

    console.log(graph.serialize());

    return graph;
}

function emitGraphUpdatedEvent() {
    const graphUpdated = new CustomEvent("graphupdated", {
        detail: "",
        bubbles: true,
        cancelable: true
    });

    document.dispatchEvent(graphUpdated);
}