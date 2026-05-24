import json
from langchain_core.messages import SystemMessage, HumanMessage

from agents.state import GraphState
from agents.llm import llm
from agents.schemas import DiagnosisOutput
from agents.prompts import DIAGNOSER_PROMPT


class DiagnosisAgentNode:
    """LangGraph node that diagnoses the student's weakest concept using an LLM."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        attempts = state["attempts"]
        kb = state["knowledge_base"]
        profile = state["profile"]

        # 2. Prompt the LLM
        structured_llm = llm.with_structured_output(DiagnosisOutput)
        
        system_msg = SystemMessage(content=DIAGNOSER_PROMPT)
        
        context = {
            "profile": profile,
            "attempts": attempts,
            "misconceptions_catalogue": kb.get("misconceptions", {}).get("items", [])
        }
        human_msg = HumanMessage(content=f"Context:\n{json.dumps(context, indent=2)}")
        
        # not totally sure this is the right way to build the context string
        # but it works for now
        result = structured_llm.invoke([system_msg, human_msg])

        # 3. Find misconception from knowledge base based on the LLM label
        misconception = None
        if result.misconception_label:
            for item in kb.get("misconceptions", {}).get("items", []):
                if item.get("id") == result.misconception_label or item.get("label") == result.misconception_label:
                    misconception = item
                    break

        # 4. Return the key updates to the GraphState
        return {
            "diagnosis": {
                "weakest_concept": result.weakest_concept,
                "top_error_tag": result.top_error_tag,
                "misconception": misconception,
                "evidence": {
                    "confidence": result.confidence,
                    "reasoning": result.reasoning,
                    "evidence_summary": result.evidence_summary,
                },
            },
            "trace": state["trace"] + [{"agent": "diagnosis-agent", "message": f"Detected weakest concept '{result.weakest_concept}' (confidence: {result.confidence})."}],
        }
