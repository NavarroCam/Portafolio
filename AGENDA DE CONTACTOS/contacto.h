#ifndef CONTACTO_H_INCLUDED
#define CONTACTO_H_INCLUDED

#define MAX_NOMBRE 30
#define MAX_TELEFONO 20

typedef struct{
    int id;
    char nombre[MAX_NOMBRE];
    char telefono[MAX_TELEFONO];
    int edad;
} Contacto;

void agregarContacto(Contacto **contactos, int *cantidad, int *ultimoID);

void listarContactos(Contacto *contactos, int cantidad);

void buscarContacto(Contacto *contactos, int cantidad);

void buscarPorID(Contacto *contactos, int cantidad);

void editarContacto(Contacto *contactos, int cantidad);

void eliminarContacto(Contacto **contactos, int *cantidad);

void ordenarContactos(Contacto *contactos, int cantidad);

#endif // CONTACTO_H_INCLUDED
