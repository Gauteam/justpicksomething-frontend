import type { ColumnType } from "./api";

// Built-in starting points for a room. Picking one pre-creates columns; people
// choose which with checkboxes (`checked` = on by default). Numbers and prices
// are short text: there's no number type, and natural sort still orders them.
export type TemplateColumn = { name: string; type: ColumnType; checked: boolean };
export type Template = { id: string; label: string; roomName: string; columns: TemplateColumn[] };

const col = (name: string, type: ColumnType, checked = true): TemplateColumn => ({ name, type, checked });

export const TEMPLATES: Template[] = [
  {
    id: "rentals",
    label: "Rental homes",
    roomName: "Rental homes",
    columns: [
      col("Link", "text"),
      col("Price per night", "text"),
      col("Bedrooms", "text"),
      col("Bathrooms", "text"),
      col("Sleeps", "text"),
      col("Location", "text", false),
      col("Hot tub", "boolean"),
      col("Pool table", "boolean"),
      col("Pool", "boolean", false),
      col("Pet friendly", "boolean", false),
      col("Parking", "boolean", false),
      col("Notes", "textarea"),
    ],
  },
  {
    id: "hotels",
    label: "Hotels",
    roomName: "Hotels",
    columns: [
      col("Link", "text"),
      col("Price per night", "text"),
      col("Star rating", "text"),
      col("Guest rating", "text"),
      col("Neighborhood", "text"),
      col("Free breakfast", "boolean"),
      col("Free cancellation", "boolean"),
      col("Pool", "boolean", false),
      col("Gym", "boolean", false),
      col("Parking", "boolean", false),
      col("Pet friendly", "boolean", false),
      col("Notes", "textarea"),
    ],
  },
  {
    id: "restaurants",
    label: "Restaurants",
    roomName: "Where to eat",
    columns: [
      col("Link", "text"),
      col("Cuisine", "text"),
      col("Price range", "text"),
      col("Neighborhood", "text"),
      col("Rating", "text", false),
      col("Takes reservations", "boolean"),
      col("Vegetarian options", "boolean"),
      col("Outdoor seating", "boolean", false),
      col("Kid friendly", "boolean", false),
      col("Open late", "boolean", false),
      col("Notes", "textarea"),
    ],
  },
];
