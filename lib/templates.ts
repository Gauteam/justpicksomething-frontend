import type { ColumnType } from "./api";

// Built-in starting points for a room. Picking one pre-creates columns; people
// choose which with checkboxes (`checked` = on by default) and can switch a
// column to an alternative name before creating. Alternatives are only other
// wordings of the same thing ("Price per night" / "Total price"); anything
// that means something different is its own column. Only the chosen name reaches the room. Numbers and
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
      col("Price per night", "text", true, ["Total price"]),
      col("Price per person", "text", false),
      col("Bedrooms", "text", true),
      col("Bathrooms", "text", true),
      col("Sleeps", "text", false, ["Max guests"]),
      col("Location", "text", false),
      col("Distance", "text", false, ["Drive time"]),
      col("Hot tub", "boolean", false),
      col("Pool table", "boolean", false),
      col("Pool", "boolean", false),
      col("Pet friendly", "boolean", false),
      col("Parking", "boolean", false),
      col("Notes", "textarea", true),
    ],
  },
  {
    id: "hotels",
    label: "Hotels",
    roomName: "Hotels",
    columns: [
      col("Link", "text", true, ["Booking link"]),
      col("Price per night", "text", true, ["Total price"]),
      col("Star rating", "text", false, ["Stars"]),
      col("Guest rating", "text", true, ["Review score"]),
      col("Neighborhood", "text", true),
      col("Distance", "text", false, ["Drive time"]),
      col("Free breakfast", "boolean", false, ["Breakfast included"]),
      col("Free cancellation", "boolean", false, ["Refundable"]),
      col("Pool", "boolean", false),
      col("Gym", "boolean", false),
      col("Parking", "boolean", false),
      col("Pet friendly", "boolean", false),
      col("Notes", "textarea", true),
    ],
  },
  {
    id: "restaurants",
    label: "Restaurants",
    roomName: "Where to eat",
    columns: [
      col("Link", "text", true),
      col("Menu", "text", false),
      col("Cuisine", "text", true),
      col("Price range", "text", true),
      col("Price per person", "text", false),
      col("Neighborhood", "text", true),
      col("Distance", "text", false, ["Drive time"]),
      col("Rating", "text", false, ["Google rating", "Yelp rating"]),
      col("Takes reservations", "boolean", false),
      col("Vegetarian options", "boolean", false),
      col("Vegan options", "boolean", false),
      col("Gluten-free options", "boolean", false),
      col("Outdoor seating", "boolean", false),
      col("Kid friendly", "boolean", false),
      col("Open late", "boolean", false),
      col("Notes", "textarea", true),
    ],
  },
];
