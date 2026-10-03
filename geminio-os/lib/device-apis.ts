import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as Calendar from 'expo-calendar';
import * as MediaLibrary from 'expo-media-library';

/**
 * Device APIs Module
 * Provides access to device hardware and native APIs
 */

/**
 * Camera & Photo Library
 */

export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request camera permission:', error);
    return false;
  }
}

export async function requestPhotoLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request photo library permission:', error);
    return false;
  }
}

export async function pickImageFromLibrary(): Promise<string | null> {
  try {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      console.warn('Photo library permission not granted');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Failed to pick image:', error);
    return null;
  }
}

export async function pickVideoFromLibrary(): Promise<string | null> {
  try {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      console.warn('Photo library permission not granted');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Failed to pick video:', error);
    return null;
  }
}

export async function takePhoto(): Promise<string | null> {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      console.warn('Camera permission not granted');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Failed to take photo:', error);
    return null;
  }
}

export async function recordVideo(): Promise<string | null> {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      console.warn('Camera permission not granted');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Failed to record video:', error);
    return null;
  }
}

/**
 * Location
 */

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request location permission:', error);
    return false;
  }
}

export async function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy?: number;
} | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.warn('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
    };
  } catch (error) {
    console.error('Failed to get current location:', error);
    return null;
  }
}

export async function watchLocation(
  callback: (location: { latitude: number; longitude: number }) => void
): Promise<() => void> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.warn('Location permission not granted');
      return () => {};
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );

    return () => subscription.remove();
  } catch (error) {
    console.error('Failed to watch location:', error);
    return () => {};
  }
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<{ address: string } | null> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (results.length > 0) {
      const { street, city, region, country } = results[0];
      const address = [street, city, region, country].filter(Boolean).join(', ');
      return { address };
    }
    return null;
  } catch (error) {
    console.error('Failed to reverse geocode:', error);
    return null;
  }
}

/**
 * Contacts
 */

export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request contacts permission:', error);
    return false;
  }
}

export async function getAllContacts(): Promise<
  Array<{ id: string; name: string; phoneNumbers?: string[] }>
> {
  try {
    const hasPermission = await requestContactsPermission();
    if (!hasPermission) {
      console.warn('Contacts permission not granted');
      return [];
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });

    return data.map((contact) => ({
      id: contact.id,
      name: contact.name || 'Unknown',
      phoneNumbers: (contact.phoneNumbers?.map((p) => p.number).filter((n): n is string => Boolean(n)) || []) as string[],
    }));
  } catch (error) {
    console.error('Failed to get contacts:', error);
    return [];
  }
}

export async function searchContacts(query: string): Promise<
  Array<{ id: string; name: string; phoneNumbers?: string[] }>
> {
  try {
    const contacts = await getAllContacts();
    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(query.toLowerCase())
    );
  } catch (error) {
    console.error('Failed to search contacts:', error);
    return [];
  }
}

/**
 * Calendar
 */

export async function requestCalendarPermission(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request calendar permission:', error);
    return false;
  }
}

export async function createCalendarEvent({
  title,
  startDate,
  endDate,
  location,
  notes,
}: {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
}): Promise<string | null> {
  try {
    const hasPermission = await requestCalendarPermission();
    if (!hasPermission) {
      console.warn('Calendar permission not granted');
      return null;
    }

    // Get the default calendar
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendar = calendars.find((cal) => cal.isPrimary);

    if (!defaultCalendar) {
      console.warn('No default calendar found');
      return null;
    }

    const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
      title,
      startDate,
      endDate,
      location,
      notes,
    });

    return eventId;
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    return null;
  }
}

export async function getCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
  }>
> {
  try {
    const hasPermission = await requestCalendarPermission();
    if (!hasPermission) {
      console.warn('Calendar permission not granted');
      return [];
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const events: Array<{
      id: string;
      title: string;
      startDate: Date;
      endDate: Date;
    }> = [];

    for (const calendar of calendars) {
      const calendarEvents = await Calendar.getEventsAsync([calendar.id], startDate, endDate);
      events.push(
        ...calendarEvents.map((event) => ({
          id: event.id,
          title: event.title,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
        }))
      );
    }

    return events;
  } catch (error) {
    console.error('Failed to get calendar events:', error);
    return [];
  }
}

/**
 * Media Library
 */

export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request media library permission:', error);
    return false;
  }
}

export async function getMediaLibraryAssets(
  limit = 20,
  offset = 0
): Promise<
  Array<{
    id: string;
    uri: string;
    mediaType: string;
    filename: string;
  }>
> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      console.warn('Media library permission not granted');
      return [];
    }

    const result = await MediaLibrary.getAssetsAsync({
      first: limit,
      after: offset.toString(),
    });

    return result.assets.map((asset) => ({
      id: asset.id,
      uri: asset.uri,
      mediaType: asset.mediaType,
      filename: asset.filename,
    }));
  } catch (error) {
    console.error('Failed to get media library assets:', error);
    return [];
  }
}

export async function saveAssetToLibrary(uri: string): Promise<boolean> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      console.warn('Media library permission not granted');
      return false;
    }

    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch (error) {
    console.error('Failed to save asset to library:', error);
    return false;
  }
}
