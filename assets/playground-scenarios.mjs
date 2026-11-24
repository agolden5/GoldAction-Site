export const scenarios = {
  estimate: {
    inquiry: "Hi, the kitchen tap has been dripping since yesterday. Could someone come by Thursday afternoon, and do you charge for an estimate?",
    draft: "Thanks for reaching out about the kitchen tap. I’ll check Thursday afternoon availability and confirm whether there’s an estimate fee. Is the water contained, or is it leaking into the cabinet?",
    review: [
      "Verify the appointment window and estimate fee before offering either.",
      "Flag an active leak for the team’s urgent-response process.",
    ],
  },
  booking: {
    inquiry: "Could I move my Friday appointment to next Monday after 2? I’m not sure if there’s a rescheduling fee.",
    draft: "I can check options for Monday after 2. Please use our usual booking channel so we can find your appointment and confirm what’s available. I’ll also check whether a rescheduling fee applies.",
    review: [
      "Verify the booking using the business’s existing process.",
      "Check availability and the rescheduling policy before confirming a change.",
    ],
  },
  workshop: {
    inquiry: "Our six-person support team spends a lot of time emailing customers about order updates. Could we run a workshop on drafting those replies?",
    draft: "Yes, order updates would be a good workflow to explore. We could map a typical inquiry, try a few fictional orders, and agree on which details a teammate should verify before sending a reply. Which type of order update takes the most time today?",
    review: [
      "Confirm workshop scope and dates before making a commitment.",
      "Use fictional orders during the exercise and keep customer records out of the demo.",
    ],
  },
};

export function isScenario(id) {
  return typeof id === "string" && Object.hasOwn(scenarios, id);
}
