#ifndef ARCHIVO_H_INCLUDED
#define ARCHIVO_H_INCLUDED

#include "contacto.h"
#define ARCHIVO_CONTACTOS "contactos.txt"

void guardarContactos(Contacto *contactos, int cantidad);
void cargarContactos(Contacto **contactos, int *cantidad, int *ultimoID);

#endif // ARCHIVO_H_INCLUDED
