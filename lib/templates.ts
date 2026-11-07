import type { ColumnType } from "./api";

// Built-in starting points for a room. Picking one pre-creates columns; people
// choose which with checkboxes (`checked` = on by default) and can switch a
// column to one of its alternative names (e.g. "Price per night" → "Total
// price") before creating. Only the chosen name reaches the room. Numbers and
// prices are short text: there's no number type, and natural sort still
// orders them.
export type TemplateColumn = { name: string; type: ColumnType; checked: boolean; alternatives: string[] };
export type Template = { id: string; label: string; roomName: string; columns: TemplateColumn[] };

const col = (name: string, type: ColumnType, checked = true, alternatives: string[] = []): TemplateColumn => ({
  name,
  type,
  checked,
  alternatives,
});

export const TEMPLATES: Template[] = [
  {
    id: "rentals",
    label: "Rental homes",
    roomName: "Rental homes",
    columns: [
      col("Link", "text", true, ["Listing"]),
      col("Price per night", "text", true, ["Total price", "Price per person"]),
      col("Bedrooms", "text", true, ["Beds"]),
      col("Bathrooms", "text"),
      col("Sleeps", "text", true, ["Max guests"]),
      col("Location", "text", false, ["Distance", "Drive time"]),
      col("Hot tub", "boolean"),
      col("Pool table", "boolean", true, ["Game room"]),
      col("Pool", "boolean", false),
      col("Pet friendly", "boolean", false),
      col("Parking", "boolean", false, ["Free parking"]),
      col("Notes", "textarea", true, ["Pros and cons"]),
    ],
  },
  {
    id: "hotels",
    label: "Hotels",
    roomName: "Hotels",
    columns: [
      col("Link", "text", true, ["Booking link"]),
      col("Price per night", "text", true, ["Total price"]),
      col("Star rating", "text", true, ["Stars"]),
      col("Guest rating", "text", true, ["Review score"]),
      col("Neighborhood", "text", true, ["Distance to center", "Distance to venue"]),
      col("Free breakfast", "boolean", true, ["Breakfast included"]),
      col("Free cancellation", "boolean", true, ["Refundable"]),
      col("Pool", "boolean", false),
      col("Gym", "boolean", false),
      col("Parking", "boolean", false, ["Free parking"]),
      col("Pet friendly", "boolean", false),
      col("Notes", "textarea", true, ["Pros and cons"]),
    ],
  },
  {
    id: "restaurants",
    label: "Restaurants",
    roomName: "Where to eat",
    columns: [
      col("Link", "text", true, ["Menu"]),
      col("Cuisine", "text"),
      col("Price range", "text", true, ["Price per person"]),
      col("Neighborhood", "text", true, ["Distance", "Drive time"]),
      col("Rating", "text", false, ["Google rating", "Yelp rating"]),
      col("Takes reservations", "boolean", true, ["Walk-ins welcome"]),
      col("Vegetarian options", "boolean", true, ["Vegan options", "Gluten-free options"]),
      col("Outdoor seating", "boolean", false),
      col("Kid friendly", "boolean", false),
      col("Open late", "boolean", false),
      col("Notes", "textarea", true, ["Must-try dishes"]),
    ],
  },
];
